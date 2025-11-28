import { describe, it, expect } from "vitest";
import { GGDDetector } from "../../src/detectors/ggd-detector.js";

describe("GGDDetector - Comment Filtering", () => {
  let detector: GGDDetector;

  beforeEach(() => {
    detector = new GGDDetector();
  });

  it("should ignore GGD in single-line comments", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        // This is a comment: Schema.getGlobalDescribe()
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should ignore GGD in block comments", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        /* This is a block comment
           Schema.getGlobalDescribe() should be ignored
        */
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should ignore GGD in multi-line block comments", () => {
    const apexCode = `
public class TestClass {
    /* 
     * Long comment block
     * Schema.getGlobalDescribe() example
     * More comments
     */
    public void testMethod() {
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should detect GGD in code but not in comments on same line", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe(); // This is actual code
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(1);
    expect(detections[0].lineNumber).toBe(4);
  });

  it("should ignore GGD in inline comments after code", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(); // Schema.getGlobalDescribe() in comment
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should handle mixed code and comments correctly", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        // Comment: Schema.getGlobalDescribe()
        Schema.getGlobalDescribe(); // Real code
        /* Block comment: Schema.getGlobalDescribe() */
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(1);
    expect(detections[0].lineNumber).toBe(5);
  });

  it("should detect actual GGD usage (not in comments)", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(1);
    expect(detections[0].className).toBe("TestClass");
    expect(detections[0].lineNumber).toBe(4);
  });

  it("should ignore GGD in single-quoted strings", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        System.debug('4. Schema.getGlobalDescribe(): for single SObject metadata');
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should ignore GGD in double-quoted strings", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        String message = 'Use Schema.getGlobalDescribe() carefully';
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should handle escaped quotes in strings", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        String message = 'Don\\'t use Schema.getGlobalDescribe()';
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should ignore GGD in strings with escaped double quotes", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        String message = 'He said, \\"Avoid Schema.getGlobalDescribe()!\\"';
        Account acc = new Account();
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(0);
  });

  it("should detect GGD in code but ignore in strings on same line", () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe(); // Real call
        System.debug('Schema.getGlobalDescribe() in string');
    }
}`;

    const detections = detector.detect("TestClass", apexCode);
    
    expect(detections.length).toBe(1);
    expect(detections[0].lineNumber).toBe(4);
  });
});
