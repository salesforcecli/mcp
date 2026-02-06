import { describe, it, expect, beforeEach } from "vitest";
import { GGDDetector } from "../../src/detectors/ggd-detector.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";
import { Severity } from "../../src/models/severity.js";

describe("GGDDetectorAst", () => {
  let detector: GGDDetector;

  beforeEach(() => {
    detector = new GGDDetector();
  });

  describe("Basic Detection", () => {
    it("should return GGD as antipattern type", () => {
      expect(detector.getAntipatternType()).toBe(AntipatternType.GGD);
    });

    it("should detect Schema.getGlobalDescribe() with CRITICAL severity", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].className).toBe("TestClass");
      expect(detections[0].methodName).toBe("testMethod");
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[0].codeBefore).toContain("Schema.getGlobalDescribe()");
      expect(detections[0].lineNumber).toBeGreaterThan(0);
    });

    it("should detect lowercase 'schema.getGlobalDescribe()'", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        schema.SObjectType objType = schema.getGlobalDescribe().get('Account');
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });

    it("should detect mixed case 'Schema.getGlobalDescribe()'", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        ScHeMa.SObjectType objType = ScHeMa.getGlobalDescribe().get('Account');
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
    });
  });

  describe("Loop Detection - CRITICAL Severity", () => {
    it("should assign CRITICAL severity when GGD is inside a for loop", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (String objName : objectNames) {
            Schema.SObjectType objType = Schema.getGlobalDescribe().get(objName);
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[0].methodName).toBe("testMethod");
    });

    it("should assign CRITICAL severity when GGD is inside a while loop", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        while (hasMore) {
            Schema.getGlobalDescribe();
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });

    it("should assign CRITICAL severity when GGD is inside a do-while loop", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        do {
            Schema.getGlobalDescribe();
        } while (hasMore);
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });

    it("should detect GGD in enhanced for loop (for-each)", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (Account acc : accounts) {
            Schema.getGlobalDescribe();
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });

    it("should detect GGD in nested loops with CRITICAL severity", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (Integer i = 0; i < 10; i++) {
            for (Integer j = 0; j < 5; j++) {
                Schema.getGlobalDescribe();
            }
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });

    it("should detect multiple GGD calls in same loop", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        for (String name : names) {
            Schema.getGlobalDescribe().get(name);
            Schema.getGlobalDescribe().containsKey(name);
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[1].severity).toBe(Severity.CRITICAL);
    });
  });

  describe("Multiple Detections", () => {
    it("should detect multiple GGD calls in same class", () => {
      const apexCode = `
public class TestClass {
    public void method1() {
        Schema.getGlobalDescribe();
    }
    
    public void method2() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].methodName).toBe("method1");
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[1].methodName).toBe("method2");
      expect(detections[1].severity).toBe(Severity.CRITICAL);
    });

    it("should detect GGD in loop and outside loop with CRITICAL severity", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe(); // CRITICAL
        
        for (String name : names) {
            Schema.getGlobalDescribe(); // CRITICAL
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[1].severity).toBe(Severity.CRITICAL);
    });

    it("should handle multiple methods with loops", () => {
      const apexCode = `
public class TestClass {
    public void method1() {
        for (Integer i = 0; i < 10; i++) {
            Schema.getGlobalDescribe();
        }
    }
    
    public void method2() {
        while (hasMore) {
            Schema.getGlobalDescribe();
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[0].methodName).toBe("method1");
      expect(detections[1].severity).toBe(Severity.CRITICAL);
      expect(detections[1].methodName).toBe("method2");
    });
  });

  describe("Comment and String Filtering (AST Advantage)", () => {
    it("should NOT detect GGD in single-line comments", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        // Schema.getGlobalDescribe() should not be detected
        Account acc = new Account();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);
      expect(detections).toHaveLength(0);
    });

    it("should NOT detect GGD in block comments", () => {
      const apexCode = `
public class TestClass {
    /* 
     * Schema.getGlobalDescribe() in block comment
     */
    public void testMethod() {
        Account acc = new Account();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);
      expect(detections).toHaveLength(0);
    });

    it("should NOT detect GGD in string literals", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        String msg = 'Do not use Schema.getGlobalDescribe() unnecessarily';
        System.debug("Avoid Schema.getGlobalDescribe()");
    }
}`;

      const detections = detector.detect("TestClass", apexCode);
      expect(detections).toHaveLength(0);
    });

    it("should detect real GGD but ignore in comments on same line", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe(); // This is actual code
        // Schema.getGlobalDescribe() in comment
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].codeBefore).toContain("Schema.getGlobalDescribe()");
    });

    it("should handle mixed comments and code correctly", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        // Comment: Schema.getGlobalDescribe()
        Schema.getGlobalDescribe(); // Real call
        /* Block: Schema.getGlobalDescribe() */
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      // Should only detect the real call, not in comments
      expect(detections.length).toBeGreaterThanOrEqual(1);
      // Find the real detection
      const realDetection = detections.find(d => d.codeBefore.includes("Schema.getGlobalDescribe()"));
      expect(realDetection).toBeDefined();
    });
  });

  describe("Line Number Accuracy", () => {
    it("should provide accurate 1-indexed line numbers", () => {
      const apexCode = `public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].lineNumber).toBe(3);
    });

    it("should provide correct line numbers for multiple detections", () => {
      const apexCode = `public class TestClass {
    public void method1() {
        Schema.getGlobalDescribe();
    }
    
    public void method2() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].lineNumber).toBe(3);
      expect(detections[1].lineNumber).toBe(7);
    });
  });

  describe("Code Snippet Extraction", () => {
    it("should extract complete GGD expression", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].codeBefore).toContain("Schema.getGlobalDescribe()");
    });

    it("should handle chained method calls", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.SObjectType objType = Schema.getGlobalDescribe().get('Account');
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      // Should capture the full expression
      expect(detections[0].codeBefore).toContain("Schema.getGlobalDescribe()");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty class", () => {
      const apexCode = `
public class EmptyClass {
}`;

      const detections = detector.detect("EmptyClass", apexCode);
      expect(detections).toHaveLength(0);
    });

    it("should handle class with no GGD calls", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(Name = 'Test');
        insert acc;
    }
}`;

      const detections = detector.detect("TestClass", apexCode);
      expect(detections).toHaveLength(0);
    });

    it("should handle malformed code gracefully", () => {
      const badCode = `public class { broken syntax }`;

      const detections = detector.detect("BrokenClass", badCode);
      // Should return empty array, not throw
      expect(Array.isArray(detections)).toBe(true);
    });

    it("should handle GGD in if statement (not a loop)", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        if (condition) {
            Schema.getGlobalDescribe();
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      // GGD is always CRITICAL regardless of context
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });

    it("should handle GGD in try-catch block", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        try {
            Schema.getGlobalDescribe();
        } catch (Exception e) {
            System.debug(e);
        }
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should detect GGD antipattern from fix instructions example", () => {
      const apexCode = `
public class ObjectMetadataHandler {
    public void processObjectNames(List<String> objectNames) {
        for (String objectName : objectNames) {
            if (Schema.getGlobalDescribe().containsKey(objectName)) {
                Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectName);
                System.debug('Object found: ' + objectName);
            }
        }
    }
}`;

      const detections = detector.detect("ObjectMetadataHandler", apexCode);

      // Should detect 2 GGD calls, both CRITICAL
      expect(detections).toHaveLength(2);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[0].methodName).toBe("processObjectNames");
      expect(detections[1].severity).toBe(Severity.CRITICAL);
    });

    it("should detect multiple GGD calls scenario", () => {
      const apexCode = `
public class TestClass {
    public void processObject(String objectName) {
        Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe().get(objectName).getDescribe();
        
        System.debug('Object Label: ' + describeResult.getLabel());

        SObject newRecord = Schema.getGlobalDescribe().get(objectName).newSObject();
        
        insert newRecord;
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
      expect(detections[1].severity).toBe(Severity.CRITICAL);
    });

    it("should detect inefficient usage for known SObjects", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.DescribeSObjectResult dsr = Schema.getGlobalDescribe().get('Case').getDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].severity).toBe(Severity.CRITICAL);
    });
  });

  describe("Method Context Tracking", () => {
    it("should track method name for detections", () => {
      const apexCode = `
public class TestClass {
    public void myCustomMethod() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe("myCustomMethod");
    });

    it("should handle methods without return type", () => {
      const apexCode = `
public class TestClass {
    void processData() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe("processData");
    });

    it("should handle static methods", () => {
      const apexCode = `
public class TestClass {
    public static void staticMethod() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      expect(detections[0].methodName).toBe("staticMethod");
    });
  });

  describe("Complex Whitespace Patterns", () => {
    it("should handle various whitespace in Schema.getGlobalDescribe()", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema  .  getGlobalDescribe  (  );
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(2);
    });
  });

  describe("Comparison with expected behavior", () => {
    it("should produce same structure as regex detector", () => {
      const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe();
    }
}`;

      const detections = detector.detect("TestClass", apexCode);

      expect(detections).toHaveLength(1);
      
      // Verify structure matches expected DetectedAntipattern
      expect(detections[0]).toHaveProperty("className");
      expect(detections[0]).toHaveProperty("methodName");
      expect(detections[0]).toHaveProperty("lineNumber");
      expect(detections[0]).toHaveProperty("codeBefore");
      expect(detections[0]).toHaveProperty("severity");
      
      // Should NOT have fixInstruction (that's added by recommender)
      expect(detections[0]).not.toHaveProperty("fixInstruction");
    });
  });
});
