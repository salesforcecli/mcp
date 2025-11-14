import { describe, it, expect } from 'vitest';
import { SOQLFieldTracker } from '../../src/utils/soql-ast-utils.js';

describe('SOQLFieldTracker', () => {
  describe('findDirectFieldAccess', () => {
    it('should find single field access', () => {
      const code = `
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        System.debug(acc.Name);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name', 'Phone']);

      expect(fields).toContain('Name');
      expect(fields).not.toContain('Phone');
    });

    it('should find multiple field accesses', () => {
      const code = `
        Account acc = [SELECT Id, Name, Phone, Industry FROM Account LIMIT 1];
        System.debug(acc.Name);
        System.debug(acc.Industry);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name', 'Phone', 'Industry']);

      expect(fields).toContain('Name');
      expect(fields).toContain('Industry');
      expect(fields).not.toContain('Phone');
    });

    it('should find field access in string concatenation', () => {
      const code = `
        Account acc = [SELECT Id, Name, Industry FROM Account LIMIT 1];
        String msg = 'Account: ' + acc.Name + ' - ' + acc.Industry;
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name', 'Industry']);

      expect(fields).toContain('Name');
      expect(fields).toContain('Industry');
    });

    it('should find field access in conditional', () => {
      const code = `
        Account acc = [SELECT Id, Name, Phone FROM Account LIMIT 1];
        if (acc.Name != null) {
          System.debug(acc.Name);
        }
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name', 'Phone']);

      expect(fields).toContain('Name');
    });

    it('should find field access in method parameter', () => {
      const code = `
        Contact con = [SELECT Id, FirstName, Email FROM Contact LIMIT 1];
        sendEmail(con.Email);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('con', code, ['Id', 'FirstName', 'Email']);

      expect(fields).toContain('Email');
    });

    it('should handle array notation field access', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 10];
        System.debug(accounts[0].Name);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('accounts', code, ['Id', 'Name']);

      expect(fields).toContain('Name');
    });

    it('should find fields accessed in loop variable', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name, Phone FROM Account];
        for (Account acc : accounts) {
          System.debug(acc.Name);
        }
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('accounts', code, ['Id', 'Name', 'Phone']);

      expect(fields).toContain('Name');
      expect(fields).not.toContain('Phone');
    });

    it('should handle relationship field access', () => {
      const code = `
        Contact con = [SELECT Id, Account.Name, Account.Phone FROM Contact LIMIT 1];
        System.debug(con.Account.Name);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('con', code, ['Id', 'Account.Name', 'Account.Phone']);

      expect(fields).toContain('Account.Name');
      expect(fields).not.toContain('Account.Phone');
    });

    it('should handle multi-level relationship access', () => {
      const code = `
        Contact con = [SELECT Id, Account.Owner.Name, Account.Owner.Email FROM Contact LIMIT 1];
        System.debug(con.Account.Owner.Name);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('con', code, ['Id', 'Account.Owner.Name', 'Account.Owner.Email']);

      expect(fields).toContain('Account.Owner.Name');
      expect(fields).not.toContain('Account.Owner.Email');
    });

    it('should be case-insensitive for field matching', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        System.debug(acc.name);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name']);

      expect(fields).toContain('Name');
    });

    it('should handle custom field access', () => {
      const code = `
        Account acc = [SELECT Id, CustomField__c FROM Account LIMIT 1];
        System.debug(acc.CustomField__c);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'CustomField__c']);

      expect(fields).toContain('CustomField__c');
    });

    it('should NOT include field assignments', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        acc.Name = 'New Name';
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name']);

      expect(fields).not.toContain('Name');
    });

    it('should include field comparisons', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        if (acc.Name == 'Test') {
          System.debug('Found');
        }
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name']);

      expect(fields).toContain('Name');
    });

    it('should handle ternary operator field access', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        String value = acc.Name != null ? acc.Name : 'Unknown';
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name']);

      expect(fields).toContain('Name');
    });

    it('should return empty array when no fields accessed', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        System.debug('No field access');
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name']);

      expect(fields).toEqual([]);
    });

    it('should handle multiple loop variables', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        for (Account acc : accounts) {
          System.debug(acc.Name);
        }
        for (Account a : accounts) {
          System.debug(a.Name);
        }
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('accounts', code, ['Id', 'Name']);

      expect(fields).toContain('Name');
    });

    it('should not duplicate fields in result', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        System.debug(acc.Name);
        System.debug(acc.Name);
        System.debug(acc.Name);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Name']);

      expect(fields).toEqual(['Name']);
    });

    it('should handle fields with numbers', () => {
      const code = `
        Account acc = [SELECT Id, Field1__c, Field2__c FROM Account LIMIT 1];
        System.debug(acc.Field1__c);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'Field1__c', 'Field2__c']);

      expect(fields).toContain('Field1__c');
      expect(fields).not.toContain('Field2__c');
    });

    it('should handle namespace prefixed fields', () => {
      const code = `
        Account acc = [SELECT Id, ns__CustomField__c FROM Account LIMIT 1];
        System.debug(acc.ns__CustomField__c);
      `;
      const fields = SOQLFieldTracker.findDirectFieldAccess('acc', code, ['Id', 'ns__CustomField__c']);

      expect(fields).toContain('ns__CustomField__c');
    });
  });

  describe('findColumnsUsedInLaterSOQLs', () => {
    it('should find field used in later SOQL', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Account WHERE ParentId = :acc.ParentId]', lineNumber: 10 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'ParentId', 'Name']);

      expect(fields).toContain('ParentId');
      expect(fields).not.toContain('Name');
    });

    it('should find multiple fields used in later SOQLs', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Account WHERE ParentId = :acc.ParentId]', lineNumber: 10 },
        { query: '[SELECT Id FROM User WHERE Id = :acc.OwnerId]', lineNumber: 15 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'ParentId', 'OwnerId', 'Name']);

      expect(fields).toContain('ParentId');
      expect(fields).toContain('OwnerId');
      expect(fields).not.toContain('Name');
    });

    it('should be case-insensitive', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Account WHERE ParentId = :ACC.PARENTID]', lineNumber: 10 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'ParentId']);

      expect(fields).toContain('ParentId');
    });

    it('should return empty array when no fields used', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Contact WHERE Name = \'Test\']', lineNumber: 10 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'Name']);

      expect(fields).toEqual([]);
    });

    it('should handle no later SOQLs', () => {
      const laterSOQLs: Array<{query: string; lineNumber: number}> = [];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'Name']);

      expect(fields).toEqual([]);
    });

    it('should not duplicate fields', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Account WHERE ParentId = :acc.ParentId]', lineNumber: 10 },
        { query: '[SELECT Name FROM Account WHERE ParentId = :acc.ParentId]', lineNumber: 15 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'ParentId']);

      expect(fields).toEqual(['ParentId']);
    });

    it('should handle custom fields', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Account WHERE CustomField__c = :acc.CustomField__c]', lineNumber: 10 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'CustomField__c']);

      expect(fields).toContain('CustomField__c');
    });

    it('should require both variable and field to be present', () => {
      const laterSOQLs = [
        { query: '[SELECT Id FROM Account WHERE ParentId = :differentVar.ParentId]', lineNumber: 10 }
      ];
      const fields = SOQLFieldTracker.findColumnsUsedInLaterSOQLs('acc', laterSOQLs, ['Id', 'ParentId']);

      expect(fields).toEqual([]);
    });
  });

  describe('checkIfCompleteSOQLResultsAreUsed', () => {
    it('should detect simple return statement', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        return acc;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(true);
    });

    it('should detect return in expression', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        return accounts;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('accounts', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(true);
    });

    it('should NOT detect field-level usage as complete', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        System.debug(acc.Name);
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should NOT detect for-each loop as complete usage', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        for (Account acc : accounts) {
          System.debug('Processing');
        }
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('accounts', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should NOT detect isEmpty() as complete usage', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        if (!accounts.isEmpty()) {
          System.debug('Has accounts');
        }
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('accounts', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should NOT detect size() as complete usage', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        Integer count = accounts.size();
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('accounts', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should NOT detect null check as complete usage', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        if (acc != null) {
          System.debug('Found account');
        }
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should NOT detect DML as complete usage', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        update acc;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should detect variable passed to method', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        processAccount(acc);
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(true);
    });

    it('should detect array element usage', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        return accounts[0];
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('accounts', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(true);
    });

    it('should NOT detect array element field access', () => {
      const code = `
        List<Account> accounts = [SELECT Id, Name FROM Account];
        System.debug(accounts[0].Name);
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('accounts', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should ignore comments', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        // return acc; (commented out)
        System.debug(acc.Name);
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should ignore block comments', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        /* 
         * return acc;
         */
        System.debug(acc.Name);
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should handle variable in comma-separated list', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        processAccounts(acc, otherAcc);
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(true);
    });

    it('should detect insert DML as complete usage', () => {
      // INSERT uses ALL fields from the object, so it's complete usage
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        insert acc;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(true);
    });

    it('should NOT detect delete DML', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        delete acc;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should NOT detect upsert DML', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        upsert acc;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });

    it('should handle case-insensitive DML', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        UPDATE acc;
      `;
      const isComplete = SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed('acc', code, 2, 1, ['Id', 'Name']);

      expect(isComplete).toBe(false);
    });
  });

  describe('isReturnedInCode', () => {
    it('should detect simple return statement', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        return acc;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(true);
    });

    it('should detect return with expression', () => {
      const code = `
        List<Account> accounts = [SELECT Id FROM Account];
        return accounts;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('accounts', code);

      expect(isReturned).toBe(true);
    });

    it('should be case-insensitive', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        RETURN acc;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(true);
    });

    it('should NOT detect when variable not returned', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        System.debug(acc);
        return null;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(false);
    });

    it('should NOT detect partial variable name match', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        return account;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(false);
    });

    it('should detect return in conditional', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        if (condition) {
          return acc;
        }
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(true);
    });

    it('should handle multiple spaces', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        return     acc;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(true);
    });

    it('should NOT match return field access', () => {
      const code = `
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        return acc.Name;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(false);
    });

    it('should handle return on separate line', () => {
      const code = `
        Account acc = [SELECT Id FROM Account LIMIT 1];
        
        return acc;
      `;
      const isReturned = SOQLFieldTracker.isReturnedInCode('acc', code);

      expect(isReturned).toBe(true);
    });
  });
});

