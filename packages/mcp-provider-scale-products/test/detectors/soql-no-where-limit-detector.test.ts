import { describe, it, expect } from 'vitest';
import { SOQLNoWhereLimitDetector } from '../../src/detectors/soql-no-where-limit-detector.js';
import { AntipatternType } from '../../src/models/antipattern-type.js';
import { Severity } from '../../src/models/severity.js';

describe('SOQLNoWhereLimitDetector', () => {
  const detector = new SOQLNoWhereLimitDetector();

  describe('getAntipatternType', () => {
    it('should return correct antipattern type', () => {
      expect(detector.getAntipatternType()).toBe(AntipatternType.SOQL_NO_WHERE_LIMIT);
    });
  });

  describe('detect', () => {
    it('should DETECT SOQL without WHERE or LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id, Name FROM Account];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
      expect(detections[0].className).toBe('Test');
      expect(detections[0].methodName).toBe('method1');
      expect(detections[0].severity).toBe(Severity.HIGH);
    });

    it('should NOT detect SOQL with WHERE but no LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account WHERE Name = 'Test'];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(0);
    });

    it('should NOT detect SOQL with LIMIT but no WHERE', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account LIMIT 100];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(0);
    });

    it('should NOT detect SOQL with both WHERE and LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id FROM Account 
              WHERE Name = 'Test' 
              LIMIT 100
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(0);
    });

    it('should detect SOQL in for loop without WHERE/LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            for (String s : myList) {
              List<Account> accounts = [SELECT Id FROM Account];
            }
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.HIGH);
    });

    it('should detect SOQL in while loop without WHERE/LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            while (someCondition) {
              List<Account> accounts = [SELECT Id FROM Account];
            }
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
    });

    it('should detect SOQL in do-while loop without WHERE/LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            do {
              List<Account> accounts = [SELECT Id FROM Account];
            } while (someCondition);
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
    });

    it('should detect multiple SOQL queries - only bad ones', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account];
            List<Contact> contacts = [SELECT Id FROM Contact WHERE Email != null];
            List<Lead> leads = [SELECT Id FROM Lead LIMIT 10];
            List<Opportunity> opps = [SELECT Id FROM Opportunity];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Should detect 2 bad queries (Account and Opportunity)
      expect(detections).toHaveLength(2);
    });

    it('should handle nested subqueries - only analyze outer query', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id, (SELECT Id FROM Contacts WHERE Email != null)
              FROM Account
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Outer query has no WHERE/LIMIT, should detect
      expect(detections).toHaveLength(1);
    });

    it('should NOT detect nested subqueries if outer query has WHERE', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id, (SELECT Id FROM Contacts)
              FROM Account
              WHERE Industry = 'Tech'
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Outer query has WHERE, should NOT detect
      expect(detections).toHaveLength(0);
    });

    it('should NOT detect nested subqueries if outer query has LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id, (SELECT Id FROM Contacts)
              FROM Account
              LIMIT 100
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Outer query has LIMIT, should NOT detect
      expect(detections).toHaveLength(0);
    });

    it('should handle empty or malformed code gracefully', () => {
      const code = `public class Test {}`;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(0);
    });

    it('should include correct line number', () => {
      const code = `public class Test {
  public void method1() {
    List<Account> accounts = [SELECT Id FROM Account];
  }
}`;
      
      const detections = detector.detect('Test', code);
      
      expect(detections[0].lineNumber).toBe(3);
    });

    it('should include code snippet in codeBefore', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections[0].codeBefore).toContain('SELECT');
      expect(detections[0].codeBefore).toContain('Account');
    });

    it('should handle SOQL with complex WHERE clauses', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id FROM Account 
              WHERE (Industry = 'Tech' OR Industry = 'Finance') 
              AND AnnualRevenue > 1000000
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Has WHERE, should NOT detect
      expect(detections).toHaveLength(0);
    });

    it('should handle SOQL with comments', () => {
      const code = `
        public class Test {
          public void method1() {
            // This query has no filter
            List<Account> accounts = [
              SELECT Id /* get account id */ FROM Account
              // No WHERE clause
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Should still detect the antipattern
      expect(detections).toHaveLength(1);
    });

    it('should handle multi-line SOQL queries', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT 
                Id, 
                Name, 
                Industry, 
                AnnualRevenue
              FROM 
                Account
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
    });

    it('should detect SOQL in nested loops', () => {
      const code = `
        public class Test {
          public void method1() {
            for (String s : list1) {
              for (String t : list2) {
                List<Account> accounts = [SELECT Id FROM Account];
              }
            }
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
    });

    it('should handle SOQL with ORDER BY but no WHERE/LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id, Name FROM Account 
              ORDER BY Name ASC
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // No WHERE or LIMIT, should detect
      expect(detections).toHaveLength(1);
    });

    it('should handle SOQL with GROUP BY but no WHERE/LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<AggregateResult> results = [
              SELECT Industry, COUNT(Id) 
              FROM Account 
              GROUP BY Industry
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // No WHERE or LIMIT, should detect
      expect(detections).toHaveLength(1);
    });

    it('should handle multiple methods with SOQL', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account];
          }
          
          public void method2() {
            List<Contact> contacts = [SELECT Id FROM Contact WHERE Email != null];
          }
          
          public void method3() {
            List<Lead> leads = [SELECT Id FROM Lead];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Should detect 2 bad queries (in method1 and method3)
      expect(detections).toHaveLength(2);
      expect(detections[0].methodName).toBe('method1');
      expect(detections[1].methodName).toBe('method3');
    });

    it('should handle SOQL in static methods', () => {
      const code = `
        public class Test {
          public static void staticMethod() {
            List<Account> accounts = [SELECT Id FROM Account];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe('staticMethod');
    });

    it('should handle SOQL in private methods', () => {
      const code = `
        public class Test {
          private void privateMethod() {
            List<Account> accounts = [SELECT Id FROM Account];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe('privateMethod');
    });

    it('should handle SOQL outside of methods (class initialization)', () => {
      const code = `
        public class Test {
          List<Account> accounts = [SELECT Id FROM Account];
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Should still detect even without method context
      expect(detections).toHaveLength(1);
    });

    it('should handle metadata queries without WHERE/LIMIT', () => {
      const code = `
        public class Test {
          public void method1() {
            List<CacheTTL__mdt> ttl = [SELECT StoreCacheTTL__c FROM CacheTTL__mdt];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(1);
    });

    it('should NOT detect metadata queries with WHERE', () => {
      const code = `
        public class Test {
          public void method1() {
            List<CacheTTL__mdt> ttl = [
              SELECT StoreCacheTTL__c 
              FROM CacheTTL__mdt 
              WHERE DeveloperName = 'Store_Cache_Settings'
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      expect(detections).toHaveLength(0);
    });

    it('should handle SOQL with bind variables', () => {
      const code = `
        public class Test {
          public void method1(String accountName) {
            List<Account> accounts = [
              SELECT Id FROM Account 
              WHERE Name = :accountName
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Has WHERE, should NOT detect
      expect(detections).toHaveLength(0);
    });

    it('should handle SOQL with date literals', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Opportunity> opps = [
              SELECT Id FROM Opportunity 
              WHERE CloseDate = THIS_YEAR
            ];
          }
        }
      `;
      
      const detections = detector.detect('Test', code);
      
      // Has WHERE, should NOT detect
      expect(detections).toHaveLength(0);
    });
  });
});

