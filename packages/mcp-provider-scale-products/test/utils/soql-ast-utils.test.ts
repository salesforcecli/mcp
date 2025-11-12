import { describe, it, expect } from 'vitest';
import { SOQLAstUtils } from '../../src/utils/soql-ast-utils.js';

describe('SOQLAstUtils', () => {
  describe('extractSOQLQueries', () => {
    it('should extract single-line SOQL query', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries).toHaveLength(1);
      expect(queries[0].query).toContain('SELECT');
      expect(queries[0].methodName).toBe('method1');
    });

    it('should extract multi-line SOQL query', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id, Name, Industry
              FROM Account
              WHERE Industry = 'Technology'
            ];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries).toHaveLength(1);
      expect(queries[0].hasWhere).toBe(true);
    });

    it('should detect WHERE clause correctly', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account WHERE Name = 'Test'];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].hasWhere).toBe(true);
      expect(queries[0].hasLimit).toBe(false);
    });

    it('should detect LIMIT clause correctly', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account LIMIT 100];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].hasWhere).toBe(false);
      expect(queries[0].hasLimit).toBe(true);
    });

    it('should detect SOQL in for loop', () => {
      const code = `
        public class Test {
          public void method1() {
            for (String s : myList) {
              List<Account> accounts = [SELECT Id FROM Account];
            }
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].inLoop).toBe(true);
    });

    it('should detect SOQL in while loop', () => {
      const code = `
        public class Test {
          public void method1() {
            while (someCondition) {
              List<Account> accounts = [SELECT Id FROM Account];
            }
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].inLoop).toBe(true);
    });

    it('should detect SOQL in do-while loop', () => {
      const code = `
        public class Test {
          public void method1() {
            do {
              List<Account> accounts = [SELECT Id FROM Account];
            } while (someCondition);
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].inLoop).toBe(true);
    });

    it('should handle nested subqueries - only check outer query', () => {
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
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      // Outer query has no WHERE/LIMIT
      expect(queries[0].hasWhere).toBe(false);
      expect(queries[0].hasLimit).toBe(false);
    });

    it('should detect complex WHERE with AND/OR', () => {
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
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].hasWhere).toBe(true);
    });

    it('should handle SOQL with comments', () => {
      const code = `
        public class Test {
          public void method1() {
            // This is a comment
            List<Account> accounts = [
              SELECT Id /* inline comment */ FROM Account
              WHERE Name = 'Test' // another comment
            ];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries).toHaveLength(1);
      expect(queries[0].hasWhere).toBe(true);
    });

    it('should handle malformed SOQL gracefully', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM
          }
        }
      `;
      
      // Should not throw error, just return empty array
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries).toBeDefined();
    });

    it('should extract multiple SOQL queries in same method', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [SELECT Id FROM Account];
            List<Contact> contacts = [SELECT Id FROM Contact LIMIT 10];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries).toHaveLength(2);
      expect(queries[0].hasLimit).toBe(false);
      expect(queries[1].hasLimit).toBe(true);
    });

    it('should detect both WHERE and LIMIT in same query', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id FROM Account 
              WHERE Industry = 'Technology' 
              LIMIT 100
            ];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].hasWhere).toBe(true);
      expect(queries[0].hasLimit).toBe(true);
    });

    it('should handle SOQL with ORDER BY', () => {
      const code = `
        public class Test {
          public void method1() {
            List<Account> accounts = [
              SELECT Id, Name FROM Account 
              WHERE Industry = 'Tech'
              ORDER BY Name ASC
              LIMIT 50
            ];
          }
        }
      `;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].hasWhere).toBe(true);
      expect(queries[0].hasLimit).toBe(true);
    });

    it('should handle empty class', () => {
      const code = `public class Test {}`;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries).toHaveLength(0);
    });

    it('should track correct line numbers', () => {
      const code = `public class Test {
  public void method1() {
    List<Account> accounts = [SELECT Id FROM Account];
  }
}`;
      
      const queries = SOQLAstUtils.extractSOQLQueries(code);
      
      expect(queries[0].lineNumber).toBe(3);
    });
  });

  describe('hasWhereClause', () => {
    it('should detect WHERE in simple query', () => {
      const query = 'SELECT Id FROM Account WHERE Name = Test';
      expect(SOQLAstUtils.hasWhereClause(query)).toBe(true);
    });

    it('should return false when no WHERE', () => {
      const query = 'SELECT Id FROM Account';
      expect(SOQLAstUtils.hasWhereClause(query)).toBe(false);
    });

    it('should ignore WHERE in subqueries', () => {
      const query = 'SELECT Id, (SELECT Id FROM Contacts WHERE Email != null) FROM Account';
      expect(SOQLAstUtils.hasWhereClause(query)).toBe(false);
    });

    it('should detect WHERE in outer query with subquery', () => {
      const query = 'SELECT Id, (SELECT Id FROM Contacts) FROM Account WHERE Industry = Tech';
      expect(SOQLAstUtils.hasWhereClause(query)).toBe(true);
    });
  });

  describe('hasLimitClause', () => {
    it('should detect LIMIT in simple query', () => {
      const query = 'SELECT Id FROM Account LIMIT 100';
      expect(SOQLAstUtils.hasLimitClause(query)).toBe(true);
    });

    it('should return false when no LIMIT', () => {
      const query = 'SELECT Id FROM Account';
      expect(SOQLAstUtils.hasLimitClause(query)).toBe(false);
    });

    it('should ignore LIMIT in subqueries', () => {
      const query = 'SELECT Id, (SELECT Id FROM Contacts LIMIT 5) FROM Account';
      expect(SOQLAstUtils.hasLimitClause(query)).toBe(false);
    });

    it('should detect LIMIT in outer query with subquery', () => {
      const query = 'SELECT Id, (SELECT Id FROM Contacts) FROM Account LIMIT 50';
      expect(SOQLAstUtils.hasLimitClause(query)).toBe(true);
    });
  });

  describe('lacksWhereAndLimit', () => {
    it('should return true when both WHERE and LIMIT are missing', () => {
      const query = 'SELECT Id FROM Account';
      expect(SOQLAstUtils.lacksWhereAndLimit(query)).toBe(true);
    });

    it('should return false when WHERE is present', () => {
      const query = 'SELECT Id FROM Account WHERE Name = Test';
      expect(SOQLAstUtils.lacksWhereAndLimit(query)).toBe(false);
    });

    it('should return false when LIMIT is present', () => {
      const query = 'SELECT Id FROM Account LIMIT 100';
      expect(SOQLAstUtils.lacksWhereAndLimit(query)).toBe(false);
    });

    it('should return false when both WHERE and LIMIT are present', () => {
      const query = 'SELECT Id FROM Account WHERE Industry = Tech LIMIT 50';
      expect(SOQLAstUtils.lacksWhereAndLimit(query)).toBe(false);
    });
  });

  describe('removeSubqueries', () => {
    it('should remove simple subquery', () => {
      const query = 'SELECT Id, (SELECT Id FROM Contacts) FROM Account';
      const cleaned = SOQLAstUtils.removeSubqueries(query);
      expect(cleaned).toBe('SELECT Id, () FROM Account');
    });

    it('should remove multiple subqueries', () => {
      const query = 'SELECT Id, (SELECT Id FROM Contacts), (SELECT Id FROM Opportunities) FROM Account';
      const cleaned = SOQLAstUtils.removeSubqueries(query);
      expect(cleaned).toBe('SELECT Id, (), () FROM Account');
    });

    it('should leave query unchanged if no subqueries', () => {
      const query = 'SELECT Id FROM Account WHERE Name = Test';
      const cleaned = SOQLAstUtils.removeSubqueries(query);
      expect(cleaned).toBe(query);
    });
  });

  describe('removeComments', () => {
    it('should remove single-line comments', () => {
      const code = 'List<Account> accounts; // This is a comment';
      const cleaned = SOQLAstUtils.removeComments(code);
      expect(cleaned).not.toContain('// This is a comment');
    });

    it('should remove block comments', () => {
      const code = 'List<Account> accounts; /* This is a comment */';
      const cleaned = SOQLAstUtils.removeComments(code);
      expect(cleaned).not.toContain('/* This is a comment */');
    });

    it('should preserve code structure', () => {
      const code = `Line 1
// Comment
Line 2`;
      const cleaned = SOQLAstUtils.removeComments(code);
      const lines = cleaned.split('\n');
      expect(lines).toHaveLength(3);
    });
  });
});

