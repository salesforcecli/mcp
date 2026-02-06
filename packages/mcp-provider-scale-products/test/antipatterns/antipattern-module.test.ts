import { describe, it, expect } from "vitest";
import { AntipatternModule } from "../../src/antipatterns/antipattern-module.js";
import { GGDDetector } from "../../src/detectors/ggd-detector.js";
import { GGDRecommender } from "../../src/recommenders/ggd-recommender.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";
import { MethodRuntimeEnricher } from "../../src/runtime-enrichers/method-runtime-enricher.js";
import { SOQLRuntimeEnricher } from "../../src/runtime-enrichers/soql-runtime-enricher.js";

describe("AntipatternModule", () => {
  it("should return AntipatternResult with grouped structure", () => {
    const detector = new GGDDetector();
    const recommender = new GGDRecommender();
    const module = new AntipatternModule(detector, recommender);

    const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.SObjectType objType = Schema.getGlobalDescribe().get('Account');
    }
}`;

    const result = module.scan("TestClass", apexCode);

    // Verify AntipatternResult structure
    expect(result).toHaveProperty("antipatternType");
    expect(result).toHaveProperty("fixInstruction");
    expect(result).toHaveProperty("detectedInstances");
    
    // Verify values
    expect(result.antipatternType).toBe(AntipatternType.GGD);
    expect(result.detectedInstances).toHaveLength(1);
    expect(result.fixInstruction).toContain("Schema.getGlobalDescribe()");
    
    // Verify instances don't have fixInstruction
    expect(result.detectedInstances[0]).not.toHaveProperty("fixInstruction");
    expect(result.detectedInstances[0].className).toBe("TestClass");
    expect(result.detectedInstances[0].codeBefore).toBeTruthy();
  });

  it("should group multiple detections with single fix instruction", () => {
    const detector = new GGDDetector();
    const recommender = new GGDRecommender();
    const module = new AntipatternModule(detector, recommender);

    const apexCode = `
public class TestClass {
    public void method1() {
        Schema.SObjectType obj1 = Schema.getGlobalDescribe().get('Account');
    }
    
    public void method2() {
        for (String name : names) {
            Schema.SObjectType obj2 = Schema.getGlobalDescribe().get(name);
        }
    }
}`;

    const result = module.scan("TestClass", apexCode);

    // CRITICAL: One instruction for multiple instances
    expect(result.detectedInstances).toHaveLength(2);
    expect(typeof result.fixInstruction).toBe("string");
    expect(result.fixInstruction.length).toBeGreaterThan(0);
    
    // Both instances share the same type-level instruction
    // GGD is always CRITICAL per parity requirements
    expect(result.detectedInstances[0].severity).toBe("critical");
    expect(result.detectedInstances[1].severity).toBe("critical");
  });

  it("should return empty detections when no antipatterns found", () => {
    const detector = new GGDDetector();
    const recommender = new GGDRecommender();
    const module = new AntipatternModule(detector, recommender);

    const apexCode = `
public class TestClass {
    public void testMethod() {
        Account acc = new Account(Name = 'Test');
    }
}`;

    const result = module.scan("TestClass", apexCode);

    expect(result.detectedInstances).toHaveLength(0);
    expect(result.fixInstruction).toBeTruthy(); // Still has instruction
  });

  it("should support detection-only workflow without recommender", () => {
    const detector = new GGDDetector();
    const module = new AntipatternModule(detector); // No recommender

    const apexCode = `
public class TestClass {
    public void method1() {
        Schema.SObjectType obj1 = Schema.getGlobalDescribe().get('Account');
    }
}`;

    const result = module.scan("TestClass", apexCode);

    expect(result.detectedInstances).toHaveLength(1);
    expect(result.fixInstruction).toContain("Manual review");
    expect(result.fixInstruction).toContain("GGD");
  });

  it("should indicate hasRecommender correctly", () => {
    const detector = new GGDDetector();
    const moduleWithRecommender = new AntipatternModule(detector, new GGDRecommender());
    const moduleWithoutRecommender = new AntipatternModule(detector);

    expect(moduleWithRecommender.hasRecommender()).toBe(true);
    expect(moduleWithoutRecommender.hasRecommender()).toBe(false);
  });

  it("should preserve all detection metadata", () => {
    const detector = new GGDDetector();
    const recommender = new GGDRecommender();
    const module = new AntipatternModule(detector, recommender);

    const apexCode = `
public class MyClass {
    public void myMethod() {
        Schema.getGlobalDescribe();
    }
}`;

    const result = module.scan("MyClass", apexCode);

    const instance = result.detectedInstances[0];
    expect(instance.className).toBe("MyClass");
    expect(instance.methodName).toBe("myMethod");
    expect(instance.lineNumber).toBeGreaterThan(0);
    expect(instance.codeBefore).toContain("getGlobalDescribe");
    expect(instance.severity).toBeTruthy();
  });

  it("should return correct antipattern type from module", () => {
    const detector = new GGDDetector();
    const module = new AntipatternModule(detector);

    expect(module.getAntipatternType()).toBe(AntipatternType.GGD);
  });

  it("should throw error when detector and recommender types mismatch", () => {
    const detector = new GGDDetector();
    
    // Create a mock recommender with mismatched type
    const mismatchedRecommender = {
      getAntipatternType: () => "DIFFERENT_TYPE" as AntipatternType,
      getFixInstruction: () => "Some fix",
    };

    expect(() => {
      new AntipatternModule(detector, mismatchedRecommender as any);
    }).toThrow("Detector and Recommender antipattern types must match");
  });

  it("should not throw error when recommender is not provided", () => {
    const detector = new GGDDetector();
    
    expect(() => {
      new AntipatternModule(detector); // No recommender - should not throw
    }).not.toThrow();
  });

  it("should throw error when runtime enricher does not support detector type", () => {
    const detector = new GGDDetector();
    const soqlEnricher = new SOQLRuntimeEnricher();

    expect(() => {
      new AntipatternModule(detector, new GGDRecommender(), soqlEnricher);
    }).toThrow("RuntimeEnricher does not support detector antipattern type");
  });

  it("should enrich detections with runtime data when enricher and runtime data provided", () => {
    const detector = new GGDDetector();
    const recommender = new GGDRecommender();
    const enricher = new MethodRuntimeEnricher();
    const module = new AntipatternModule(detector, recommender, enricher);

    const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.getGlobalDescribe();
    }
}`;
    const runtimeData = {
      methods: [
        {
          methodName: "testMethod",
          entrypoints: [
            {
              entrypointName: "Trigger",
              avgCpuTime: 3000,
              avgDbTime: 100,
              sumCpuTime: 6000,
              sumDbTime: 200,
            },
          ],
        },
      ],
      soqlRuntimeData: [],
    };

    const result = module.scan("TestClass", apexCode, runtimeData);

    expect(result.detectedInstances).toHaveLength(1);
    expect(result.detectedInstances[0].severitySource).toBe("runtime");
    expect(result.detectedInstances[0].entrypoints_impacted_by_method).toBeTruthy();
  });

  it("should indicate hasRuntimeEnricher correctly", () => {
    const detector = new GGDDetector();
    const withEnricher = new AntipatternModule(detector, new GGDRecommender(), new MethodRuntimeEnricher());
    const withoutEnricher = new AntipatternModule(detector, new GGDRecommender());

    expect(withEnricher.hasRuntimeEnricher()).toBe(true);
    expect(withoutEnricher.hasRuntimeEnricher()).toBe(false);
  });
});
