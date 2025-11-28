import { describe, it, expect } from 'vitest';
import { SOQLUnusedFieldsRecommender } from '../../src/recommenders/soql-unused-fields-recommender.js';
import { AntipatternType } from '../../src/models/antipattern-type.js';
import { DetectedAntipattern, SOQLUnusedFieldsMetadata } from '../../src/models/detection-result.js';
import { Severity } from '../../src/models/severity.js';

describe('SOQLUnusedFieldsRecommender', () => {
  const recommender = new SOQLUnusedFieldsRecommender();

  describe('getAntipatternType', () => {
    it('should return SOQL_UNUSED_FIELDS as antipattern type', () => {
      expect(recommender.getAntipatternType()).toBe(AntipatternType.SOQL_UNUSED_FIELDS);
    });
  });

  describe('getFixInstruction', () => {
    it('should return comprehensive fix instruction', () => {
      const instruction = recommender.getFixInstruction();

      expect(typeof instruction).toBe('string');
      expect(instruction.length).toBeGreaterThan(100);

      expect(instruction).toContain('SOQL');
      expect(instruction).toContain('unused');
      expect(instruction).toContain('fields');
      expect(instruction).toContain('Problem');
    });

    it('should include solution strategies in instruction', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('Solution');
      expect(instruction).toContain('Remove');
      expect(instruction).toContain('SELECT');
    });

    it('should include code examples in instruction', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('Example');
      expect(instruction).toContain('BEFORE');
      expect(instruction).toContain('AFTER');
      expect(instruction).toContain('```apex');
    });

    it('should include severity context', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('HIGH');
      expect(instruction).toContain('MEDIUM');
    });

    it('should include performance impact guidance', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('Performance');
      expect(instruction).toContain('Impact');
      expect(instruction).toContain('heap');
    });

    it('should include best practices section', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('Best Practices');
    });

    it('should include exclusion patterns', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('Exclusion');
      expect(instruction).toContain('returned');
      expect(instruction).toContain('class member');
      expect(instruction).toContain('nested');
    });

    it('should include system fields documentation', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('System Fields');
      expect(instruction).toContain('Id');
      expect(instruction).toContain('COUNT');
    });

    it('should include LLM application guidance', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('How to Apply');
      expect(instruction).toContain('unusedFields');
      expect(instruction).toContain('codeAfter');
    });

    it('should include documentation references', () => {
      const instruction = recommender.getFixInstruction();

      expect(instruction).toContain('Reference');
      expect(instruction).toContain('salesforce');
    });

    it('should return same instruction on multiple calls (stateless)', () => {
      const instruction1 = recommender.getFixInstruction();
      const instruction2 = recommender.getFixInstruction();

      expect(instruction1).toBe(instruction2);
    });
  });

  describe('recommend - Basic Code Generation', () => {
    it('should generate codeAfter with unused fields removed', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, Industry FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone', 'Industry'],
          originalFields: ['Id', 'Name', 'Phone', 'Industry'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      expect(result.detectedInstances).toHaveLength(1);
      const instance = result.detectedInstances[0];
      
      expect(instance.codeAfter).toBeDefined();
      expect(instance.codeAfter).toContain('SELECT');
      expect(instance.codeAfter).toContain('Name');
      expect(instance.codeAfter).not.toContain('Phone');
      expect(instance.codeAfter).not.toContain('Industry');
    });

    it('should preserve FROM clause and WHERE conditions', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account WHERE Name != null LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('FROM Account');
      expect(instance.codeAfter).toContain('WHERE');
      expect(instance.codeAfter).toContain('LIMIT 1');
    });

    it('should preserve ORDER BY clauses', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account ORDER BY Name ASC LIMIT 10]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('ORDER BY');
    });
  });

  describe('recommend - Safety Checks', () => {
    it('should return empty string for nested queries', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, (SELECT Id FROM Contacts) FROM Account]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: true,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toBe('');
    });

    it('should return empty string when all fields would be removed', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Id', 'Name'],
          originalFields: ['Id', 'Name'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toBe('');
    });

    it('should handle edge case with only one field remaining', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Name', 'Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('SELECT');
      expect(instance.codeAfter).toContain('Id');
    });
  });

  describe('recommend - Multiple Detections', () => {
    it('should handle multiple detections', () => {
      const detections: DetectedAntipattern[] = [
        {
          className: 'TestClass',
          methodName: 'method1',
          lineNumber: 5,
          codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
          severity: Severity.MEDIUM,
          metadata: {
            unusedFields: ['Phone'],
            originalFields: ['Id', 'Name', 'Phone'],
            assignedVariable: 'acc',
            isInLoop: false,
            isReturned: false,
            isClassMember: false,
            hasNestedQueries: false,
            usedInLaterSOQLs: [],
            completeUsageDetected: false,
          } as SOQLUnusedFieldsMetadata,
        },
        {
          className: 'TestClass',
          methodName: 'method2',
          lineNumber: 10,
          codeBefore: '[SELECT Id, FirstName, LastName, Email FROM Contact LIMIT 1]',
          severity: Severity.HIGH,
          metadata: {
            unusedFields: ['Email'],
            originalFields: ['Id', 'FirstName', 'LastName', 'Email'],
            assignedVariable: 'con',
            isInLoop: true,
            isReturned: false,
            isClassMember: false,
            hasNestedQueries: false,
            usedInLaterSOQLs: [],
            completeUsageDetected: false,
          } as SOQLUnusedFieldsMetadata,
        },
      ];

      const result = recommender.recommend(detections);

      expect(result.detectedInstances).toHaveLength(2);
      
      const instance1 = result.detectedInstances[0];
      expect(instance1.codeAfter).not.toContain('Phone');
      expect(instance1.severity).toBe(Severity.MEDIUM);
      
      const instance2 = result.detectedInstances[1];
      expect(instance2.codeAfter).not.toContain('Email');
      expect(instance2.severity).toBe(Severity.HIGH);
    });

    it('should preserve all detection metadata', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.className).toBe('TestClass');
      expect(instance.methodName).toBe('testMethod');
      expect(instance.lineNumber).toBe(5);
      expect(instance.codeBefore).toBeDefined();
      expect(instance.codeAfter).toBeDefined();
      expect(instance.severity).toBe(Severity.MEDIUM);
      expect(instance.metadata).toBeDefined();
      const metadata = instance.metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toEqual(['Phone']);
      expect(metadata.originalFields).toEqual(['Id', 'Name', 'Phone']);
    });
  });

  describe('recommend - Result Structure', () => {
    it('should return proper AntipatternResult structure', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      expect(result).toHaveProperty('antipatternType');
      expect(result).toHaveProperty('fixInstruction');
      expect(result).toHaveProperty('detectedInstances');
      
      expect(result.antipatternType).toBe(AntipatternType.SOQL_UNUSED_FIELDS);
      expect(typeof result.fixInstruction).toBe('string');
      expect(Array.isArray(result.detectedInstances)).toBe(true);
    });

    it('should handle empty detections array', () => {
      const result = recommender.recommend([]);

      expect(result.detectedInstances).toHaveLength(0);
      expect(result.antipatternType).toBe(AntipatternType.SOQL_UNUSED_FIELDS);
      expect(result.fixInstruction).toBeDefined();
    });
  });

  describe('recommend - Complex Field Names', () => {
    it('should handle relationship fields', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, FirstName, Account.Name, Account.Phone FROM Contact LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Account.Phone'],
          originalFields: ['Id', 'FirstName', 'Account.Name', 'Account.Phone'],
          assignedVariable: 'con',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Account.Name');
      expect(instance.codeAfter).not.toContain('Account.Phone');
    });

    it('should handle custom fields', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, CustomField__c, AnotherField__c FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['CustomField__c'],
          originalFields: ['Id', 'Name', 'CustomField__c', 'AnotherField__c'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('AnotherField__c');
      expect(instance.codeAfter).not.toContain('CustomField__c');
    });

    it('should handle fields with namespace prefixes', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Apttus_Proposal__Primary__c, SfdcQuoteStatus__c FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['SfdcQuoteStatus__c'],
          originalFields: ['Id', 'Name', 'Apttus_Proposal__Primary__c', 'SfdcQuoteStatus__c'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Apttus_Proposal__Primary__c');
      expect(instance.codeAfter).not.toContain('SfdcQuoteStatus__c');
    });
  });

  describe('recommend - Severity Preservation', () => {
    it('should preserve MEDIUM severity', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      expect(result.detectedInstances[0].severity).toBe(Severity.MEDIUM);
    });

    it('should preserve HIGH severity for loop context', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.HIGH,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: true,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      expect(result.detectedInstances[0].severity).toBe(Severity.HIGH);
    });
  });

  describe('recommend - Real-World Scenarios', () => {
    it('should optimize batch processing query', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'processBatch',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, Fax, Website, Industry, AnnualRevenue FROM Account WHERE Id IN :ids]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone', 'Fax', 'Website', 'AnnualRevenue'],
          originalFields: ['Id', 'Name', 'Phone', 'Fax', 'Website', 'Industry', 'AnnualRevenue'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Name');
      expect(instance.codeAfter).toContain('Industry');
      expect(instance.codeAfter).not.toContain('Phone');
      expect(instance.codeAfter).not.toContain('Fax');
      expect(instance.codeAfter).not.toContain('Website');
      expect(instance.codeAfter).not.toContain('AnnualRevenue');
    });

    it('should handle validation scenario with multiple unused fields', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'validateContact',
        lineNumber: 5,
        codeBefore: '[SELECT Id, FirstName, LastName, Email, Phone, Title, Department FROM Contact WHERE Id = :id]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone', 'Title', 'Department'],
          originalFields: ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'Title', 'Department'],
          assignedVariable: 'con',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('FirstName');
      expect(instance.codeAfter).toContain('LastName');
      expect(instance.codeAfter).toContain('Email');
      expect(instance.codeAfter).not.toContain('Phone');
      expect(instance.codeAfter).not.toContain('Title');
      expect(instance.codeAfter).not.toContain('Department');
    });
  });

  describe('recommend - Instance Properties', () => {
    it('should include unusedFields property', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      const metadata = instance.metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toEqual(['Phone']);
    });

    it('should include originalFields property', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      const metadata = instance.metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.originalFields).toEqual(['Id', 'Name', 'Phone']);
    });

    it('should preserve metadata object', () => {
      const metadata: SOQLUnusedFieldsMetadata = {
        unusedFields: ['Phone'],
        originalFields: ['Id', 'Name', 'Phone'],
        assignedVariable: 'acc',
        isInLoop: false,
        isReturned: false,
        isClassMember: false,
        hasNestedQueries: false,
        usedInLaterSOQLs: [],
        completeUsageDetected: false,
      };

      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.metadata).toEqual(metadata);
    });
  });

  describe('recommend - Additional Edge Cases', () => {
    it('should handle SOQL with multiple unused fields', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, Fax, Website, Industry FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone', 'Fax', 'Website'],
          originalFields: ['Id', 'Name', 'Phone', 'Fax', 'Website', 'Industry'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Name');
      expect(instance.codeAfter).toContain('Industry');
      expect(instance.codeAfter).not.toContain('Phone');
      expect(instance.codeAfter).not.toContain('Fax');
      expect(instance.codeAfter).not.toContain('Website');
    });

    it('should handle SOQL with WHERE IN clause', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account WHERE Id IN :accountIds]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('WHERE');
      expect(instance.codeAfter).toContain('IN');
    });

    it('should handle SOQL with ORDER BY multiple fields', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, Industry FROM Account ORDER BY Name ASC, Industry DESC]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone', 'Industry'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('ORDER BY');
    });

    it('should handle SOQL with complex WHERE conditions', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account WHERE (Name LIKE \'%Test%\' OR Industry = \'Tech\') AND AnnualRevenue > 1000000]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('WHERE');
      expect(instance.codeAfter).not.toContain('Phone');
    });

    it('should handle SOQL with NULLS FIRST/LAST', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account ORDER BY Name NULLS FIRST]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      if (instance.codeAfter) {
        expect(instance.codeAfter).not.toContain('Phone');
      }
    });

    it('should handle SOQL with FOR REFERENCE', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account FOR REFERENCE]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      if (instance.codeAfter) {
        expect(instance.codeAfter).not.toContain('Phone');
      }
    });

    it('should handle very long field lists', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, Fax, Website, Industry, AnnualRevenue, NumberOfEmployees, Description, Type, Rating, Ownership, TickerSymbol, Site FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone', 'Fax', 'Website', 'AnnualRevenue', 'NumberOfEmployees', 'Description', 'Type', 'Rating', 'Ownership', 'TickerSymbol', 'Site'],
          originalFields: ['Id', 'Name', 'Phone', 'Fax', 'Website', 'Industry', 'AnnualRevenue', 'NumberOfEmployees', 'Description', 'Type', 'Rating', 'Ownership', 'TickerSymbol', 'Site'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Name');
      expect(instance.codeAfter).toContain('Industry');
      expect(instance.codeAfter).not.toContain('Phone');
      expect(instance.codeAfter).not.toContain('Fax');
    });

    it('should handle single unused field among many', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, Industry FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone', 'Industry'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Name');
      expect(instance.codeAfter).toContain('Industry');
      expect(instance.codeAfter).not.toContain('Phone');
    });

    it('should handle SOQL with multi-level relationship', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Account.Owner.Name, Account.Owner.Email FROM Contact LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Account.Owner.Email'],
          originalFields: ['Id', 'Name', 'Account.Owner.Name', 'Account.Owner.Email'],
          assignedVariable: 'con',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      if (instance.codeAfter) {
        expect(instance.codeAfter).toContain('Account.Owner.Name');
        expect(instance.codeAfter).not.toContain('Account.Owner.Email');
      }
    });

    it('should maintain query structure with mix of standard and custom fields', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone, CustomField__c, AnotherCustom__c FROM Account LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone', 'AnotherCustom__c'],
          originalFields: ['Id', 'Name', 'Phone', 'CustomField__c', 'AnotherCustom__c'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Name');
      expect(instance.codeAfter).toContain('CustomField__c');
      expect(instance.codeAfter).not.toContain('Phone');
      expect(instance.codeAfter).not.toContain('AnotherCustom__c');
    });

    it('should handle empty codeAfter gracefully for nested queries', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, (SELECT Id FROM Contacts) FROM Account]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Name'],
          originalFields: ['Id', 'Name'],
          assignedVariable: 'acc',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: true,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toBe('');
      expect(instance.codeBefore).toBeDefined();
      const metadata = instance.metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toEqual(['Name']);
    });

    it('should preserve LIMIT with various values', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Phone FROM Account LIMIT 50000]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Phone'],
          originalFields: ['Id', 'Name', 'Phone'],
          assignedVariable: 'accounts',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('LIMIT');
      expect(instance.codeAfter).toContain('50000');
    });

    it('should handle fields with underscores and numbers', () => {
      const detection: DetectedAntipattern = {
        className: 'TestClass',
        methodName: 'testMethod',
        lineNumber: 5,
        codeBefore: '[SELECT Id, Name, Field_1__c, Field_2__c, Field_3__c FROM CustomObject__c LIMIT 1]',
        severity: Severity.MEDIUM,
        metadata: {
          unusedFields: ['Field_2__c', 'Field_3__c'],
          originalFields: ['Id', 'Name', 'Field_1__c', 'Field_2__c', 'Field_3__c'],
          assignedVariable: 'obj',
          isInLoop: false,
          isReturned: false,
          isClassMember: false,
          hasNestedQueries: false,
          usedInLaterSOQLs: [],
          completeUsageDetected: false,
        } as SOQLUnusedFieldsMetadata,
      };

      const result = recommender.recommend([detection]);

      const instance = result.detectedInstances[0];
      expect(instance.codeAfter).toContain('Field_1__c');
      expect(instance.codeAfter).not.toContain('Field_2__c');
      expect(instance.codeAfter).not.toContain('Field_3__c');
    });
  });
});

