import { describe, it, expect, beforeEach } from "vitest";
import { AntipatternRegistry } from "../../src/antipatterns/antipattern-registry.js";
import { AntipatternModule } from "../../src/antipatterns/antipattern-module.js";
import { GGDDetector } from "../../src/detectors/ggd-detector.js";
import { GGDRecommender } from "../../src/recommenders/ggd-recommender.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";

describe("AntipatternRegistry", () => {
  let registry: AntipatternRegistry;
  let ggdModule: AntipatternModule;

  beforeEach(() => {
    registry = new AntipatternRegistry();
    ggdModule = new AntipatternModule(new GGDDetector(), new GGDRecommender());
  });

  it("should register a module", () => {
    registry.register(ggdModule);
    
    const modules = registry.getAllModules();
    expect(modules.length).toBe(1);
    expect(modules[0]).toBe(ggdModule);
  });

  it("should get a registered module by type", () => {
    registry.register(ggdModule);
    
    const retrieved = registry.getModule(AntipatternType.GGD);
    expect(retrieved).toBe(ggdModule);
  });

  it("should return undefined for unregistered type", () => {
    const retrieved = registry.getModule(AntipatternType.GGD);
    expect(retrieved).toBeUndefined();
  });

  it("should get all registered modules", () => {
    registry.register(ggdModule);
    
    const modules = registry.getAllModules();
    expect(modules.length).toBe(1);
    expect(modules[0].getAntipatternType()).toBe(AntipatternType.GGD);
  });

  it("should get all registered types", () => {
    registry.register(ggdModule);
    
    const types = registry.getRegisteredTypes();
    expect(types.length).toBe(1);
    expect(types[0]).toBe(AntipatternType.GGD);
  });

  it("should handle multiple registrations", () => {
    registry.register(ggdModule);
    // Re-registering the same type should replace the previous one
    const anotherGgdModule = new AntipatternModule(new GGDDetector(), new GGDRecommender());
    registry.register(anotherGgdModule);
    
    const modules = registry.getAllModules();
    expect(modules.length).toBe(1);
    expect(modules[0]).toBe(anotherGgdModule); // Should be the second one
  });

  it("should return empty arrays when no modules are registered", () => {
    expect(registry.getAllModules()).toEqual([]);
    expect(registry.getRegisteredTypes()).toEqual([]);
  });
});
