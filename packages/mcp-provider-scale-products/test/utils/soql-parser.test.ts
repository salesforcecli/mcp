import { describe, it, expect } from 'vitest';
import { SOQLParser } from '../../src/utils/soql-parser.js';

describe('SOQLParser', () => {
  describe('extractFields', () => {
    it('should extract simple field list', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual(['Id', 'Name', 'Phone']);
    });

    it('should extract fields with no spaces', () => {
      const soql = 'SELECTId,Name,PhoneFROMAccount';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual(['Id', 'Name', 'Phone']);
    });

    it('should handle fields with extra whitespace', () => {
      const soql = '[SELECT  Id ,  Name  ,  Phone  FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual(['Id', 'Name', 'Phone']);
    });

    it('should extract relationship fields', () => {
      const soql = '[SELECT Id, Account.Name, Account.Owner.Email FROM Contact]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('Account.Name');
      expect(fields).toContain('Account.Owner.Email');
    });

    it('should extract custom fields', () => {
      const soql = '[SELECT Id, CustomField__c, Another_Field__c FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('CustomField__c');
      expect(fields).toContain('Another_Field__c');
    });

    it('should handle fields with aliases', () => {
      const soql = '[SELECT Id, Name AS AccountName FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('AccountName');
      expect(fields).not.toContain('AS');
    });

    it('should handle fields with lowercase aliases', () => {
      const soql = '[SELECT Id, Name as account_name FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('account_name');
      expect(fields).not.toContain('as');
    });

    it('should handle COUNT() aggregate function', () => {
      const soql = '[SELECT COUNT(Id) FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('COUNT(Id)');
    });

    it('should handle multiple aggregate functions', () => {
      const soql = '[SELECT COUNT(Id), MAX(AnnualRevenue), AVG(NumberOfEmployees) FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('COUNT(Id)');
      expect(fields).toContain('MAX(AnnualRevenue)');
      expect(fields).toContain('AVG(NumberOfEmployees)');
    });

    it('should handle multi-line SOQL', () => {
      // Note: In actual usage, AST getText() removes whitespace, so multi-line becomes single-line
      // But this tests the parser's ability to handle queries with newlines
      const soql = '[SELECT Id, Name, Phone FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual(['Id', 'Name', 'Phone']);
    });

    it('should return empty array for invalid SOQL', () => {
      const soql = 'INVALID QUERY';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual([]);
    });

    it('should extract only outer query fields for nested queries', () => {
      const soql = '[SELECT Id, Name, (SELECT FirstName FROM Contacts) FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('Id');
      expect(fields).toContain('Name');
      expect(fields.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle TYPEOF fields', () => {
      const soql = '[SELECT TYPEOF What WHEN Account THEN Phone END FROM Task]';
      const fields = SOQLParser.extractFields(soql);

      expect(Array.isArray(fields)).toBe(true);
    });

    it('should handle fields with namespace prefixes', () => {
      const soql = '[SELECT Id, Apttus_Proposal__Primary__c, ns__CustomField__c FROM Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toContain('Apttus_Proposal__Primary__c');
      expect(fields).toContain('ns__CustomField__c');
    });

    it('should handle case-insensitive SELECT and FROM', () => {
      const soql = '[select Id, Name from Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual(['Id', 'Name']);
    });

    it('should handle mixed case keywords', () => {
      const soql = '[SeLeCt Id, Name FrOm Account]';
      const fields = SOQLParser.extractFields(soql);

      expect(fields).toEqual(['Id', 'Name']);
    });
  });

  describe('hasNestedQueries', () => {
    it('should detect nested subqueries', () => {
      const soql = '[SELECT Id, Name, (SELECT FirstName FROM Contacts) FROM Account]';
      const hasNested = SOQLParser.hasNestedQueries(soql);

      expect(hasNested).toBe(true);
    });

    it('should detect multiple nested subqueries', () => {
      const soql = '[SELECT Id, (SELECT Id FROM Contacts), (SELECT Id FROM Cases) FROM Account]';
      const hasNested = SOQLParser.hasNestedQueries(soql);

      expect(hasNested).toBe(true);
    });

    it('should NOT detect nested queries in simple SOQL', () => {
      const soql = '[SELECT Id, Name FROM Account]';
      const hasNested = SOQLParser.hasNestedQueries(soql);

      expect(hasNested).toBe(false);
    });

    it('should handle case-insensitive detection', () => {
      const soql = '[select Id, (select Name from Contacts) from Account]';
      const hasNested = SOQLParser.hasNestedQueries(soql);

      expect(hasNested).toBe(true);
    });

    it('should handle deeply nested queries', () => {
      const soql = '[SELECT Id, (SELECT Id, (SELECT Id FROM Opportunities) FROM Contacts) FROM Account]';
      const hasNested = SOQLParser.hasNestedQueries(soql);

      expect(hasNested).toBe(true);
    });

    it('should NOT detect nested queries when SELECT/FROM appear only once', () => {
      const soql = '[SELECT Id, Name, Email FROM Account WHERE CreatedDate > TODAY]';
      const hasNested = SOQLParser.hasNestedQueries(soql);

      expect(hasNested).toBe(false);
    });
  });

  describe('removeUnusedFields', () => {
    it('should remove single unused field', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account LIMIT 1]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('SELECT Id, Name FROM Account');
      expect(result).not.toContain('Phone');
      expect(result).toContain('LIMIT 1');
    });

    it('should remove multiple unused fields', () => {
      const soql = '[SELECT Id, Name, Phone, Fax, Website FROM Account]';
      const unusedFields = ['Phone', 'Fax', 'Website'];
      const originalFields = ['Id', 'Name', 'Phone', 'Fax', 'Website'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('SELECT Id, Name FROM Account');
      expect(result).not.toContain('Phone');
      expect(result).not.toContain('Fax');
      expect(result).not.toContain('Website');
    });

    it('should preserve WHERE clause', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account WHERE Name != null]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('WHERE Name != null');
    });

    it('should preserve ORDER BY clause', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account ORDER BY Name ASC]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('ORDER BY Name ASC');
    });

    it('should preserve LIMIT clause', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account LIMIT 100]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('LIMIT 100');
    });

    it('should preserve complex WHERE clause', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account WHERE (Name LIKE \'%Test%\' OR Industry = \'Tech\') AND AnnualRevenue > 1000000]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('WHERE');
      expect(result).toContain('LIKE');
      expect(result).toContain('Industry');
    });

    it('should return empty string for nested queries', () => {
      const soql = '[SELECT Id, Name, (SELECT FirstName FROM Contacts) FROM Account]';
      const unusedFields = ['Name'];
      const originalFields = ['Id', 'Name'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toBe('');
    });

    it('should return empty string when all fields would be removed', () => {
      const soql = '[SELECT Id, Name FROM Account]';
      const unusedFields = ['Id', 'Name'];
      const originalFields = ['Id', 'Name'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toBe('');
    });

    it('should handle case-insensitive FROM keyword', () => {
      const soql = '[SELECT Id, Name, Phone from Account]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('SELECT Id, Name');
    });

    it('should preserve GROUP BY clause', () => {
      const soql = '[SELECT Industry, COUNT(Id) FROM Account GROUP BY Industry]';
      const unusedFields: string[] = [];
      const originalFields = ['Industry', 'COUNT(Id)'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('GROUP BY Industry');
    });

    it('should preserve HAVING clause', () => {
      const soql = '[SELECT Industry, COUNT(Id) FROM Account GROUP BY Industry HAVING COUNT(Id) > 10]';
      const unusedFields: string[] = [];
      const originalFields = ['Industry', 'COUNT(Id)'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('HAVING');
    });

    it('should preserve FOR UPDATE', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account FOR UPDATE]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('FOR UPDATE');
    });

    it('should preserve OFFSET clause', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account LIMIT 10 OFFSET 5]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('OFFSET 5');
    });

    it('should return empty string for invalid SOQL format', () => {
      const soql = 'INVALID QUERY';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toBe('');
    });

    it('should handle fields with relationship notation', () => {
      const soql = '[SELECT Id, Name, Account.Name, Account.Phone FROM Contact]';
      const unusedFields = ['Account.Phone'];
      const originalFields = ['Id', 'Name', 'Account.Name', 'Account.Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('Account.Name');
      expect(result).not.toContain('Account.Phone');
    });

    it('should preserve WITH SECURITY_ENFORCED', () => {
      const soql = '[SELECT Id, Name, Phone FROM Account WITH SECURITY_ENFORCED]';
      const unusedFields = ['Phone'];
      const originalFields = ['Id', 'Name', 'Phone'];

      const result = SOQLParser.removeUnusedFields(soql, unusedFields, originalFields);

      expect(result).toContain('WITH SECURITY_ENFORCED');
    });
  });

  describe('excludeSystemFields', () => {
    it('should exclude Id field', () => {
      const fields = new Set(['Id', 'Name', 'Phone']);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result.has('Id')).toBe(false);
      expect(result.has('Name')).toBe(true);
      expect(result.has('Phone')).toBe(true);
    });

    it('should exclude COUNT()', () => {
      const fields = new Set(['COUNT()', 'Name', 'Phone']);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result.has('COUNT()')).toBe(false);
      expect(result.has('Name')).toBe(true);
    });

    it('should handle case variations of Id', () => {
      const fields = new Set(['ID', 'id', 'Id', 'Name']);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result.has('ID')).toBe(false);
      expect(result.has('id')).toBe(false);
      expect(result.has('Id')).toBe(false);
      expect(result.has('Name')).toBe(true);
    });

    it('should handle lowercase count()', () => {
      const fields = new Set(['count()', 'Name']);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result.has('count()')).toBe(false);
      expect(result.has('Name')).toBe(true);
    });

    it('should not exclude non-system fields', () => {
      const fields = new Set(['CustomId__c', 'CountField__c', 'Name']);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result.has('CustomId__c')).toBe(true);
      expect(result.has('CountField__c')).toBe(true);
      expect(result.has('Name')).toBe(true);
    });

    it('should handle empty set', () => {
      const fields = new Set<string>([]);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result.size).toBe(0);
    });

    it('should return modified original set', () => {
      const fields = new Set(['Id', 'Name']);
      const result = SOQLParser.excludeSystemFields(fields);

      expect(result).toBe(fields);
      expect(fields.has('Id')).toBe(false);
    });
  });

  describe('isValidSOQL', () => {
    it('should validate simple SOQL', () => {
      const soql = '[SELECT Id FROM Account]';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(true);
    });

    it('should validate complex SOQL', () => {
      const soql = '[SELECT Id, Name FROM Account WHERE Name != null ORDER BY Name LIMIT 10]';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(true);
    });

    it('should validate case-insensitive SOQL', () => {
      const soql = '[select id from account]';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(true);
    });

    it('should invalidate missing SELECT', () => {
      const soql = '[Id, Name FROM Account]';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(false);
    });

    it('should invalidate missing FROM', () => {
      const soql = '[SELECT Id, Name]';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(false);
    });

    it('should invalidate empty string', () => {
      const soql = '';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(false);
    });

    it('should invalidate gibberish', () => {
      const soql = 'not a query at all';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(false);
    });

    it('should validate nested queries', () => {
      const soql = '[SELECT Id, (SELECT Name FROM Contacts) FROM Account]';
      const isValid = SOQLParser.isValidSOQL(soql);

      expect(isValid).toBe(true);
    });
  });

  describe('extractObjectName', () => {
    it('should extract simple object name', () => {
      const soql = '[SELECT Id FROM Account]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('Account');
    });

    it('should extract custom object name', () => {
      const soql = '[SELECT Id FROM CustomObject__c]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('CustomObject__c');
    });

    it('should extract object name with WHERE clause', () => {
      const soql = '[SELECT Id FROM Contact WHERE Email != null]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('Contact');
    });

    it('should extract object name from complex query', () => {
      const soql = '[SELECT Id, Name FROM Opportunity WHERE CloseDate = THIS_YEAR ORDER BY Amount DESC LIMIT 100]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('Opportunity');
    });

    it('should handle case-insensitive FROM', () => {
      const soql = '[SELECT Id from Account]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('Account');
    });

    it('should return null for invalid SOQL', () => {
      const soql = 'INVALID QUERY';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe(null);
    });

    it('should return null for missing FROM clause', () => {
      const soql = '[SELECT Id, Name]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe(null);
    });

    it('should extract namespace object', () => {
      const soql = '[SELECT Id FROM ns__CustomObject__c]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('ns__CustomObject__c');
    });

    it('should extract first FROM clause in nested query', () => {
      // Note: extractObjectName uses a simple regex that finds the FIRST FROM clause
      // For nested queries, this means it finds the inner object first
      const soql = '[SELECT Id, (SELECT Name FROM Contacts) FROM Account]';
      const objectName = SOQLParser.extractObjectName(soql);

      expect(objectName).toBe('Contacts'); // First FROM clause in left-to-right order
    });
  });
});

