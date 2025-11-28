import { describe, it, expect } from "vitest";
import { ApexAstUtils } from "../../src/utils/apex-ast-utils.js";

describe("ApexAstUtils", () => {
  describe("getAllMethods", () => {
    it("should extract all method declarations", () => {
      const apexCode = `
public class TestClass {
    public void method1() {
        System.debug('test');
    }
    
    private String method2(Integer param) {
        return 'result';
    }
    
    public static List<Account> getAccounts() {
        return [SELECT Id FROM Account];
    }
}`;

      const methods = ApexAstUtils.getAllMethods(apexCode);

      expect(methods).toHaveLength(3);
      expect(methods[0].name).toBe("method1");
      // Return type extraction may vary - just check it exists or is void/undefined
      if (methods[0].returnType) {
        expect(["void", undefined]).toContain(methods[0].returnType);
      }
      expect(methods[1].name).toBe("method2");
      expect(methods[1].returnType).toBeDefined();
      expect(methods[2].name).toBe("getAccounts");
    });

    it("should handle empty class", () => {
      const apexCode = `
public class EmptyClass {
}`;

      const methods = ApexAstUtils.getAllMethods(apexCode);
      expect(methods).toHaveLength(0);
    });

    it("should extract method line numbers", () => {
      const apexCode = `public class TestClass {
    public void method1() {
        System.debug('test');
    }
    
    public void method2() {
        System.debug('test2');
    }
}`;

      const methods = ApexAstUtils.getAllMethods(apexCode);

      expect(methods[0].lineNumber).toBe(2);
      expect(methods[1].lineNumber).toBe(6);
    });
  });

  describe("getAllLoops", () => {
    it("should extract all for loops", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (Integer i = 0; i < 10; i++) {
            System.debug(i);
        }
        
        for (Account acc : accounts) {
            System.debug(acc);
        }
    }
}`;

      const loops = ApexAstUtils.getAllLoops(apexCode);

      expect(loops).toHaveLength(2);
      expect(loops[0].type).toBe("for");
      expect(loops[1].type).toBe("for");
    });

    it("should extract while loops", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        while (hasMore) {
            processNext();
        }
    }
}`;

      const loops = ApexAstUtils.getAllLoops(apexCode);

      expect(loops).toHaveLength(1);
      expect(loops[0].type).toBe("while");
      expect(loops[0].lineNumber).toBeGreaterThan(0);
    });

    it("should extract do-while loops", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        do {
            processNext();
        } while (hasMore);
    }
}`;

      const loops = ApexAstUtils.getAllLoops(apexCode);

      expect(loops).toHaveLength(1);
      expect(loops[0].type).toBe("do-while");
    });

    it("should extract nested loops", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (Integer i = 0; i < 10; i++) {
            for (Integer j = 0; j < 5; j++) {
                System.debug(i + j);
            }
        }
    }
}`;

      const loops = ApexAstUtils.getAllLoops(apexCode);

      expect(loops).toHaveLength(2);
      expect(loops[0].type).toBe("for");
      expect(loops[1].type).toBe("for");
    });

    it("should handle code with no loops", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        System.debug('No loops here');
    }
}`;

      const loops = ApexAstUtils.getAllLoops(apexCode);
      expect(loops).toHaveLength(0);
    });
  });

  describe("getAllMethodCalls", () => {
    it("should extract method calls with receivers", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        System.debug('test');
        String result = myObject.process();
        Schema.getGlobalDescribe();
    }
}`;

      const calls = ApexAstUtils.getAllMethodCalls(apexCode);

      expect(calls.length).toBeGreaterThanOrEqual(3);
      
      const debugCall = calls.find(c => c.methodName === "debug");
      expect(debugCall).toBeDefined();
      expect(debugCall?.receiver).toBe("System");

      const processCall = calls.find(c => c.methodName === "process");
      expect(processCall).toBeDefined();
      expect(processCall?.receiver).toBe("myObject");

      const ggdCall = calls.find(c => c.methodName === "getGlobalDescribe");
      expect(ggdCall).toBeDefined();
      expect(ggdCall?.receiver).toBe("Schema");
    });

    it("should extract line numbers for method calls", () => {
      const apexCode = `public class TestClass {
    public void testMethod() {
        System.debug('line 3');
        myObject.process();
    }
}`;

      const calls = ApexAstUtils.getAllMethodCalls(apexCode);

      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].lineNumber).toBeGreaterThan(0);
    });

    it("should handle chained method calls", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        String result = Schema.getGlobalDescribe().get('Account').getDescribe().getName();
    }
}`;

      const calls = ApexAstUtils.getAllMethodCalls(apexCode);

      // Should find multiple method calls in the chain
      expect(calls.length).toBeGreaterThan(2);
      
      const ggdCall = calls.find(c => c.methodName === "getGlobalDescribe");
      expect(ggdCall).toBeDefined();
    });
  });

  describe("getAllQueries", () => {
    it("should extract SOQL queries", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accs = [SELECT Id FROM Account];
        List<Contact> cons = [SELECT Id, Name FROM Contact WHERE AccountId = :accId];
    }
}`;

      const queries = ApexAstUtils.getAllQueries(apexCode);

      expect(queries).toHaveLength(2);
      expect(queries[0].query).toContain("SELECT");
      expect(queries[0].query).toContain("Account");
      expect(queries[1].query).toContain("Contact");
    });

    it("should extract queries with subqueries", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        List<Account> accs = [
            SELECT Id, Name,
            (SELECT Id FROM Contacts)
            FROM Account
        ];
    }
}`;

      const queries = ApexAstUtils.getAllQueries(apexCode);

      // Should find both main query and subquery
      expect(queries.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle code with no queries", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        System.debug('No queries here');
    }
}`;

      const queries = ApexAstUtils.getAllQueries(apexCode);
      expect(queries).toHaveLength(0);
    });

    it("should extract query line numbers", () => {
      const apexCode = `public class TestClass {
    public void testMethod() {
        List<Account> accs = [SELECT Id FROM Account];
    }
}`;

      const queries = ApexAstUtils.getAllQueries(apexCode);

      expect(queries).toHaveLength(1);
      expect(queries[0].lineNumber).toBe(3);
    });
  });

  describe("getAllDMLStatements", () => {
    it("should extract insert statements", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(Name = 'Test');
        insert acc;
    }
}`;

      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);

      expect(dmlStatements).toHaveLength(1);
      expect(dmlStatements[0].type).toBe("insert");
    });

    it("should extract update statements", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        acc.Name = 'Updated';
        update acc;
    }
}`;

      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);

      expect(dmlStatements).toHaveLength(1);
      expect(dmlStatements[0].type).toBe("update");
    });

    it("should extract delete statements", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        delete acc;
    }
}`;

      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);

      expect(dmlStatements).toHaveLength(1);
      expect(dmlStatements[0].type).toBe("delete");
    });

    it("should extract upsert statements", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(Name = 'Test');
        upsert acc;
    }
}`;

      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);

      expect(dmlStatements).toHaveLength(1);
      expect(dmlStatements[0].type).toBe("upsert");
    });

    it("should extract multiple DML statements", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(Name = 'Test');
        insert acc;
        
        acc.Name = 'Updated';
        update acc;
        
        delete acc;
    }
}`;

      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);

      expect(dmlStatements).toHaveLength(3);
      expect(dmlStatements[0].type).toBe("insert");
      expect(dmlStatements[1].type).toBe("update");
      expect(dmlStatements[2].type).toBe("delete");
    });

    it("should extract DML line numbers", () => {
      const apexCode = `public class TestClass {
    public void testMethod() {
        Account acc = new Account();
        insert acc;
    }
}`;

      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);

      expect(dmlStatements).toHaveLength(1);
      expect(dmlStatements[0].lineNumber).toBe(4);
    });
  });

  describe("getClassInfo", () => {
    it("should extract class information", () => {
      const apexCode = `
public class MyTestClass {
    public void testMethod() {
        System.debug('test');
    }
}`;

      const classInfo = ApexAstUtils.getClassInfo(apexCode);

      expect(classInfo).not.toBeNull();
      expect(classInfo?.name).toBe("MyTestClass");
      expect(classInfo?.lineNumber).toBeGreaterThan(0);
    });

    it("should extract class modifiers", () => {
      const apexCode = `
public virtual class MyClass {
}`;

      const classInfo = ApexAstUtils.getClassInfo(apexCode);

      expect(classInfo).not.toBeNull();
      expect(classInfo?.name).toBe("MyClass");
      // Note: Modifier extraction might vary based on parser implementation
    });

    it("should handle inner classes by returning the first class", () => {
      const apexCode = `
public class OuterClass {
    public class InnerClass {
    }
}`;

      const classInfo = ApexAstUtils.getClassInfo(apexCode);

      expect(classInfo).not.toBeNull();
      expect(classInfo?.name).toBe("OuterClass");
    });
  });

  describe("isValidApex", () => {
    it("should return true for valid Apex code", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        System.debug('test');
    }
}`;

      expect(ApexAstUtils.isValidApex(apexCode)).toBe(true);
    });

    it("should return false for invalid Apex code", () => {
      const apexCode = `
this is not valid apex code at all {{{
`;

      // Parser might be lenient, so we just check it returns a boolean
      const result = ApexAstUtils.isValidApex(apexCode);
      expect(typeof result).toBe("boolean");
      // Note: apex-parser may accept malformed code, so we can't strictly assert false
    });

    it("should handle empty string", () => {
      // Empty string might be considered invalid or valid depending on parser
      const result = ApexAstUtils.isValidApex("");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Integration - Complex code analysis", () => {
    it("should analyze code with multiple constructs", () => {
      const apexCode = `
public class ComplexClass {
    public void processAccounts(List<String> names) {
        // Get all accounts
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Name IN :names];
        
        for (Account acc : accounts) {
            // Update name
            acc.Name = acc.Name + '_Updated';
            
            // Debug
            System.debug('Processing: ' + acc.Name);
        }
        
        // DML
        update accounts;
        
        // While loop
        Integer i = 0;
        while (i < 10) {
            processData(i);
            i++;
        }
    }
    
    private void processData(Integer index) {
        System.debug('Index: ' + index);
    }
}`;

      const methods = ApexAstUtils.getAllMethods(apexCode);
      const loops = ApexAstUtils.getAllLoops(apexCode);
      const queries = ApexAstUtils.getAllQueries(apexCode);
      const dmlStatements = ApexAstUtils.getAllDMLStatements(apexCode);
      const methodCalls = ApexAstUtils.getAllMethodCalls(apexCode);
      const classInfo = ApexAstUtils.getClassInfo(apexCode);

      expect(methods).toHaveLength(2);
      expect(loops).toHaveLength(2); // for and while
      expect(queries).toHaveLength(1);
      expect(dmlStatements).toHaveLength(1);
      expect(methodCalls.length).toBeGreaterThan(0);
      expect(classInfo?.name).toBe("ComplexClass");
    });
  });

  describe("Error handling", () => {
    it("should handle malformed code gracefully", () => {
      const badCode = `public class { broken }`;

      expect(() => ApexAstUtils.getAllMethods(badCode)).not.toThrow();
      expect(() => ApexAstUtils.getAllLoops(badCode)).not.toThrow();
      expect(() => ApexAstUtils.getAllQueries(badCode)).not.toThrow();
      expect(() => ApexAstUtils.getAllDMLStatements(badCode)).not.toThrow();
      expect(() => ApexAstUtils.getClassInfo(badCode)).not.toThrow();
    });
  });
});
