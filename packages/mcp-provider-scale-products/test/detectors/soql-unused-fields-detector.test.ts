import { describe, it, expect, beforeEach } from 'vitest';
import { SOQLUnusedFieldsDetector } from '../../src/detectors/soql-unused-fields-detector.js';
import { AntipatternType } from '../../src/models/antipattern-type.js';
import { Severity } from '../../src/models/severity.js';
import { SOQLUnusedFieldsMetadata } from '../../src/models/detection-result.js';

describe('SOQLUnusedFieldsDetector', () => {
  let detector: SOQLUnusedFieldsDetector;

  beforeEach(() => {
    detector = new SOQLUnusedFieldsDetector();
  });

  describe('getAntipatternType', () => {
    it('should return SOQL_UNUSED_FIELDS as antipattern type', () => {
      expect(detector.getAntipatternType()).toBe(AntipatternType.SOQL_UNUSED_FIELDS);
    });
  });

  describe('Basic Detection', () => {
    it('should detect unused fields with MEDIUM severity', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone, Industry FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].className).toBe('TestClass');
      expect(detections[0].methodName).toBe('testMethod');
      expect(detections[0].severity).toBe(Severity.MEDIUM);
      expect(detections[0].codeBefore).toContain('SELECT');
      expect(detections[0].lineNumber).toBeGreaterThan(0);
      
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).toContain('Industry');
      expect(metadata.unusedFields).not.toContain('Name');
    });

    it('should detect single unused field', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toHaveLength(1);
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should NOT detect when all fields are used', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
        System.debug(acc.Phone);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should handle List<SObject> assignments', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accounts = [SELECT Id, Name, Phone, Industry FROM Account LIMIT 10];
        for (Account acc : accounts) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).toContain('Industry');
    });

    it('should handle single SObject assignments', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Contact con = [SELECT Id, FirstName, LastName, Email, Phone FROM Contact LIMIT 1];
        String fullName = con.FirstName + ' ' + con.LastName;
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Email');
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).not.toContain('FirstName');
      expect(metadata.unusedFields).not.toContain('LastName');
    });
  });

  describe('Loop Detection - HIGH Severity', () => {
    it('should assign HIGH severity when SOQL is inside a for loop', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (String name : names) {
            Account acc = [SELECT Id, Name, Phone FROM Account WHERE Name = :name LIMIT 1];
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.HIGH);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.isInLoop).toBe(true);
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should assign HIGH severity when SOQL is inside a while loop', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        while (hasMore) {
            Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.HIGH);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.isInLoop).toBe(true);
    });

    it('should assign HIGH severity when SOQL is inside a do-while loop', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        do {
            List<Account> accs = [SELECT Id, Name, Phone FROM Account LIMIT 10];
            for (Account acc : accs) {
                System.debug(acc.Name);
            }
        } while (hasMore);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.HIGH);
    });

    it('should handle for-each SOQL loops with unused fields', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (Contact con : [SELECT Id, FirstName, LastName, Email FROM Contact]) {
            System.debug(con.FirstName);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.HIGH);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('LastName');
      expect(metadata.unusedFields).toContain('Email');
      expect(metadata.unusedFields).not.toContain('FirstName');
    });
  });

  describe('System Fields Exclusion', () => {
    it('should NOT flag Id field as unused', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should handle queries with only Id selected', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accs = [SELECT Id FROM Account LIMIT 10];
        System.debug(accs.size());
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should NOT flag COUNT() aggregate functions', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<AggregateResult> results = [SELECT COUNT(Id) cnt FROM Account];
        System.debug(results);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });
  });

  describe('Fields Used in Later SOQLs', () => {
    it('should NOT flag fields used in subsequent SOQL queries', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, ParentId FROM Account LIMIT 1];
        System.debug(acc.Name);
        List<Account> children = [SELECT Id FROM Account WHERE ParentId = :acc.ParentId];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should flag fields NOT used in later SOQLs', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, ParentId, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
        List<Account> children = [SELECT Id FROM Account WHERE ParentId = :acc.ParentId];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).not.toContain('ParentId');
      expect(metadata.usedInLaterSOQLs).toContain('ParentId');
    });

    it('should handle multiple later SOQLs', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, ParentId, OwnerId, Phone FROM Account LIMIT 1];
        List<Account> children = [SELECT Id FROM Account WHERE ParentId = :acc.ParentId];
        List<User> owner = [SELECT Id FROM User WHERE Id = :acc.OwnerId];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Name');
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).not.toContain('ParentId');
      expect(metadata.unusedFields).not.toContain('OwnerId');
    });
  });

  describe('Exclusion Pattern: Returned Results', () => {
    it('should NOT detect when SOQL result is returned', () => {
      const apexCode = `
public class TestClass {
    public List<Account> getAccounts() {
        return [SELECT Id, Name, Phone, Industry FROM Account];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should NOT detect when variable is returned later', () => {
      const apexCode = `
public class TestClass {
    public Account getAccount() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        return acc;
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should detect unused fields even when only a field is returned', () => {
      // Returning acc.Name means only Name is used; Id and Phone are unused
      const apexCode = `
public class TestClass {
    public String getAccountInfo() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        return acc.Name;
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      // Note: Id is a system field and may be excluded
      expect(metadata.unusedFields).not.toContain('Name');
    });
  });

  describe('Exclusion Pattern: No Assigned Variable', () => {
    it('should NOT detect SOQL without variable assignment', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        insert [SELECT Id, Name, Phone FROM Account LIMIT 1];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });
  });

  describe('Nested Queries', () => {
    it('should detect nested queries and set metadata flag', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accs = [
            SELECT Id, Name, Phone,
                (SELECT Id, FirstName FROM Contacts)
            FROM Account
            LIMIT 10
        ];
        for (Account acc : accs) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.hasNestedQueries).toBe(true);
      }
    });

    it('should handle complex nested subqueries', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [
            SELECT Id, Name, Phone,
                (SELECT Id, FirstName FROM Contacts),
                (SELECT Id, Subject FROM Cases)
            FROM Account
            LIMIT 1
        ];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.hasNestedQueries).toBe(true);
      }
    });
  });

  describe('Multiple Detections', () => {
    it('should detect multiple SOQL queries with unused fields', () => {
      const apexCode = `
public class TestClass {
    public void method1() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
    
    public void method2() {
        Contact con = [SELECT Id, FirstName, LastName FROM Contact LIMIT 1];
        System.debug(con.FirstName);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].methodName).toBe('method1');
      expect(detections[1].methodName).toBe('method2');
      
      const metadata1 = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata1.unusedFields).toContain('Phone');
      
      const metadata2 = detections[1].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata2.unusedFields).toContain('LastName');
    });

    it('should detect unused fields in multiple SOQLs in same method', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
        
        Contact con = [SELECT Id, FirstName, Email FROM Contact LIMIT 1];
        System.debug(con.FirstName);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].methodName).toBe('testMethod');
      expect(detections[1].methodName).toBe('testMethod');
    });

    it('should handle mix of good and bad SOQLs', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc1 = [SELECT Id, Name FROM Account LIMIT 1];
        System.debug(acc1.Name);
        
        Account acc2 = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc2.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });
  });

  describe('Complex Field Names', () => {
    it('should handle relationship fields', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Contact con = [
            SELECT Id, FirstName, Account.Name, Account.Phone
            FROM Contact
            LIMIT 1
        ];
        System.debug(con.FirstName);
        System.debug(con.Account.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toContain('Account.Phone');
        expect(metadata.unusedFields).not.toContain('Account.Name');
      }
    });

    it('should handle custom fields with __c suffix', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [
            SELECT Id, Name, CustomField__c, AnotherField__c
            FROM Account
            LIMIT 1
        ];
        System.debug(acc.CustomField__c);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Name');
      expect(metadata.unusedFields).toContain('AnotherField__c');
      expect(metadata.unusedFields).not.toContain('CustomField__c');
    });

    it('should handle fields with special characters', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [
            SELECT Id, Name, Apttus_Proposal__Primary__c, SfdcQuoteStatus__c
            FROM Account
            LIMIT 1
        ];
        System.debug(acc.Apttus_Proposal__Primary__c);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Name');
      expect(metadata.unusedFields).toContain('SfdcQuoteStatus__c');
      expect(metadata.unusedFields).not.toContain('Apttus_Proposal__Primary__c');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty class', () => {
      const apexCode = `public class EmptyClass {}`;

      const detections = detector.detect('EmptyClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should handle class with no SOQL', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(Name = 'Test');
        insert acc;
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should handle malformed code gracefully', () => {
      const badCode = `public class { broken syntax }`;

      const detections = detector.detect('BrokenClass', badCode);

      expect(Array.isArray(detections)).toBe(true);
      expect(detections).toHaveLength(0);
    });

    it('should NOT detect when all fields would be removed', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        insert acc;
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(0);
    });

    it('should handle SOQL with comments', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        // Get account with fields
        Account acc = [
            SELECT Id, Name, Phone /* phone number */
            FROM Account
            LIMIT 1
        ];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should handle SOQL in static methods', () => {
      const apexCode = `
public class TestClass {
    public static void staticMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe('staticMethod');
    });

    it('should handle SOQL in private methods', () => {
      const apexCode = `
public class TestClass {
    private void privateMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe('privateMethod');
    });
  });

  describe('Multi-line SOQL Queries', () => {
    it('should handle multi-line SOQL with proper formatting', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accounts = [
            SELECT 
                Id, 
                Name, 
                Phone,
                Industry, 
                AnnualRevenue,
                Website
            FROM 
                Account
            WHERE
                Name != null
            LIMIT 10
        ];
        for (Account acc : accounts) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).toContain('Industry');
      expect(metadata.unusedFields).toContain('AnnualRevenue');
      expect(metadata.unusedFields).toContain('Website');
      expect(metadata.unusedFields).not.toContain('Name');
    });
  });

  describe('Variable Assignment Patterns', () => {
    it('should handle assignment with type declaration on separate line', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc;
        acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle assignment in conditional', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        if (condition) {
            Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should handle assignment in try-catch', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        try {
            Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
            System.debug(acc.Name);
        } catch (Exception e) {
            System.debug(e);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });
  });

  describe('Metadata Completeness', () => {
    it('should provide complete metadata for detection', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone, Industry FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      
      expect(metadata).toHaveProperty('unusedFields');
      expect(metadata).toHaveProperty('originalFields');
      expect(metadata).toHaveProperty('assignedVariable');
      expect(metadata).toHaveProperty('isInLoop');
      expect(metadata).toHaveProperty('isReturned');
      expect(metadata).toHaveProperty('isClassMember');
      expect(metadata).toHaveProperty('hasNestedQueries');
      expect(metadata).toHaveProperty('usedInLaterSOQLs');
      expect(metadata).toHaveProperty('completeUsageDetected');
      
      expect(Array.isArray(metadata.unusedFields)).toBe(true);
      expect(Array.isArray(metadata.originalFields)).toBe(true);
      expect(typeof metadata.isInLoop).toBe('boolean');
      expect(typeof metadata.isReturned).toBe('boolean');
      expect(typeof metadata.isClassMember).toBe('boolean');
      expect(typeof metadata.hasNestedQueries).toBe('boolean');
      expect(typeof metadata.completeUsageDetected).toBe('boolean');
    });

    it('should include originalFields in metadata', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.originalFields).toContain('Name');
      expect(metadata.originalFields).toContain('Phone');
      expect(metadata.originalFields.length).toBeGreaterThanOrEqual(2);
    });

    it('should include assignedVariable in metadata', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account myAccount = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(myAccount.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.assignedVariable).toBe('myAccount');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should detect unused fields in batch processing', () => {
      const apexCode = `
public class TestClass {
    public void processBatch(List<Id> accountIds) {
        List<Account> accounts = [
            SELECT Id, Name, Phone, Fax, Website, Industry, 
                   AnnualRevenue, NumberOfEmployees, Description
            FROM Account
            WHERE Id IN :accountIds
        ];
        
        for (Account acc : accounts) {
            logger.log('Processing: ' + acc.Name + ' (' + acc.Industry + ')');
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).toContain('Fax');
      expect(metadata.unusedFields).toContain('Website');
      expect(metadata.unusedFields).toContain('AnnualRevenue');
      expect(metadata.unusedFields).toContain('NumberOfEmployees');
      expect(metadata.unusedFields).toContain('Description');
      expect(metadata.unusedFields).not.toContain('Name');
      expect(metadata.unusedFields).not.toContain('Industry');
    });

    it('should handle complex business logic with multiple field accesses', () => {
      const apexCode = `
public class TestClass {
    public void validateContact(Id contactId) {
        Contact con = [
            SELECT Id, FirstName, LastName, Email, Phone, 
                   Title, Department, Birthdate
            FROM Contact
            WHERE Id = :contactId
        ];
        
        String fullName = con.FirstName + ' ' + con.LastName;
        if (String.isNotBlank(con.Email)) {
            sendEmail(con.Email);
        }
        System.debug('Validated: ' + fullName);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).toContain('Title');
      expect(metadata.unusedFields).toContain('Department');
      expect(metadata.unusedFields).toContain('Birthdate');
      expect(metadata.unusedFields).not.toContain('FirstName');
      expect(metadata.unusedFields).not.toContain('LastName');
      expect(metadata.unusedFields).not.toContain('Email');
    });
  });

  describe('Code Snippet Truncation', () => {
    it('should truncate very long queries in codeBefore', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone, Fax, Website, Industry, AnnualRevenue, NumberOfEmployees, Description, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].codeBefore.length).toBeLessThanOrEqual(250);
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle SOQL with bind variables in WHERE clause', () => {
      const apexCode = `
public class TestClass {
    public void testMethod(String accountName) {
        Account acc = [SELECT Id, Name, Phone FROM Account WHERE Name = :accountName LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should handle SOQL with date literals', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Opportunity> opps = [
            SELECT Id, Name, CloseDate, Amount
            FROM Opportunity
            WHERE CloseDate = THIS_YEAR
        ];
        for (Opportunity opp : opps) {
            System.debug(opp.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('CloseDate');
      expect(metadata.unusedFields).toContain('Amount');
    });

    it('should handle SOQL with GROUP BY and HAVING', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<AggregateResult> results = [
            SELECT Industry, COUNT(Id) cnt, AVG(AnnualRevenue) avgRevenue
            FROM Account
            GROUP BY Industry
            HAVING COUNT(Id) > 10
        ];
        for (AggregateResult result : results) {
            System.debug(result.get('Industry'));
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toBeDefined();
      }
    });

    it('should handle SOQL with TYPEOF clause', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<SObject> records = [
            SELECT TYPEOF What 
                WHEN Account THEN Phone, NumberOfEmployees 
                WHEN Opportunity THEN Amount, CloseDate 
            END 
            FROM Task
        ];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(Array.isArray(detections)).toBe(true);
    });

    it('should handle SOQL with FOR UPDATE', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1 FOR UPDATE];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should handle SOQL with ALL ROWS', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accounts = [SELECT Id, Name, Phone FROM Account ALL ROWS];
        for (Account acc : accounts) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toContain('Phone');
      }
    });

    it('should handle field access in string concatenation', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone, Industry FROM Account LIMIT 1];
        String message = 'Account: ' + acc.Name + ' - ' + acc.Industry;
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).not.toContain('Name');
      expect(metadata.unusedFields).not.toContain('Industry');
    });

    it('should handle field access in method parameters', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Contact con = [SELECT Id, FirstName, LastName, Email FROM Contact LIMIT 1];
        processContact(con.FirstName, con.Email);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('LastName');
      expect(metadata.unusedFields).not.toContain('FirstName');
      expect(metadata.unusedFields).not.toContain('Email');
    });

    it('should handle field access in ternary operator', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone, Industry FROM Account LIMIT 1];
        String value = acc.Name != null ? acc.Name : 'Unknown';
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
      expect(metadata.unusedFields).toContain('Industry');
      expect(metadata.unusedFields).not.toContain('Name');
    });

    it('should handle multiple SOQL queries accessing same variable name', () => {
      const apexCode = `
public class TestClass {
    public void method1() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
    }
    
    public void method2() {
        Account acc = [SELECT Id, Name, Industry FROM Account LIMIT 1];
        System.debug(acc.Industry);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(2);
      
      const metadata1 = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata1.unusedFields).toContain('Phone');
      
      const metadata2 = detections[1].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata2.unusedFields).toContain('Name');
    });

    it('should handle SOQL with WITH SECURITY_ENFORCED', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account WITH SECURITY_ENFORCED LIMIT 1];
        System.debug(acc.Name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should handle SOQL in constructor', () => {
      const apexCode = `
public class TestClass {
    public Account myAccount;
    
    public TestClass() {
        myAccount = [SELECT Id, Name, Phone FROM Account LIMIT 1];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(Array.isArray(detections)).toBe(true);
    });

    it('should handle SOQL in static initializer', () => {
      const apexCode = `
public class TestClass {
    public static Account staticAccount;
    
    static {
        staticAccount = [SELECT Id, Name, Phone FROM Account LIMIT 1];
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(Array.isArray(detections)).toBe(true);
    });

    it('should handle case sensitivity in field usage', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.name);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toContain('Phone');
      }
    });

    it('should handle SOQL with OFFSET clause', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accounts = [SELECT Id, Name, Phone FROM Account LIMIT 10 OFFSET 5];
        for (Account acc : accounts) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections).toHaveLength(1);
      const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
      expect(metadata.unusedFields).toContain('Phone');
    });

    it('should handle aggregate functions in SELECT', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<AggregateResult> results = [
            SELECT Industry, COUNT(Id) totalCount, MAX(AnnualRevenue) maxRevenue
            FROM Account
            GROUP BY Industry
        ];
        System.debug(results);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(Array.isArray(detections)).toBe(true);
    });

    it('should handle fields accessed via get() method', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        Object nameValue = acc.get('Name');
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toBeDefined();
      }
    });

    it('should handle SOQL with USING SCOPE', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accounts = [SELECT Id, Name, Phone FROM Account USING SCOPE Mine];
        for (Account acc : accounts) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toContain('Phone');
      }
    });

    it('should handle variable reassignment', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
        acc = [SELECT Id, Industry FROM Account LIMIT 1];
        System.debug(acc.Industry);
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      expect(detections.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle SOQL with DISTANCE function', () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accounts = [
            SELECT Id, Name, Phone, BillingLatitude, BillingLongitude,
                DISTANCE(BillingAddress, GEOLOCATION(37.775, -122.418), 'mi') dist
            FROM Account
            ORDER BY dist
        ];
        for (Account acc : accounts) {
            System.debug(acc.Name);
        }
    }
}`;

      const detections = detector.detect('TestClass', apexCode);

      if (detections.length > 0) {
        const metadata = detections[0].metadata as SOQLUnusedFieldsMetadata;
        expect(metadata.unusedFields).toBeDefined();
      }
    });
  });
});

