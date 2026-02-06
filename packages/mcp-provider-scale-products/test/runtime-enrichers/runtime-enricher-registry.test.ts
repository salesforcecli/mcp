import { describe, it, expect } from "vitest";
import { RuntimeEnricherRegistry } from "../../src/runtime-enrichers/runtime-enricher-registry.js";
import { MethodRuntimeEnricher } from "../../src/runtime-enrichers/method-runtime-enricher.js";
import { SOQLRuntimeEnricher } from "../../src/runtime-enrichers/soql-runtime-enricher.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";

describe("RuntimeEnricherRegistry", () => {
  it("should register enricher and get by type", () => {
    const registry = new RuntimeEnricherRegistry();
    const methodEnricher = new MethodRuntimeEnricher();
    registry.register(methodEnricher);
    expect(registry.getRuntimeEnricher(AntipatternType.GGD)).toBe(methodEnricher);
  });

  it("should return undefined for unregistered type", () => {
    const registry = new RuntimeEnricherRegistry();
    expect(registry.getRuntimeEnricher(AntipatternType.GGD)).toBeUndefined();
  });

  it("should register enricher for multiple types", () => {
    const registry = new RuntimeEnricherRegistry();
    const soqlEnricher = new SOQLRuntimeEnricher();
    registry.register(soqlEnricher);
    expect(registry.getRuntimeEnricher(AntipatternType.SOQL_NO_WHERE_LIMIT)).toBe(soqlEnricher);
    expect(registry.getRuntimeEnricher(AntipatternType.SOQL_UNUSED_FIELDS)).toBe(soqlEnricher);
  });

  it("should return all enrichers as unique instances", () => {
    const registry = new RuntimeEnricherRegistry();
    const methodEnricher = new MethodRuntimeEnricher();
    const soqlEnricher = new SOQLRuntimeEnricher();
    registry.register(methodEnricher);
    registry.register(soqlEnricher);
    const all = registry.getAllEnrichers();
    expect(all).toHaveLength(2);
    expect(all).toContain(methodEnricher);
    expect(all).toContain(soqlEnricher);
  });

  it("should deduplicate enrichers in getAllEnrichers when one handles multiple types", () => {
    const registry = new RuntimeEnricherRegistry();
    registry.register(new SOQLRuntimeEnricher());
    const all = registry.getAllEnrichers();
    expect(all).toHaveLength(1);
  });

  it("should report hasEnricher correctly", () => {
    const registry = new RuntimeEnricherRegistry();
    registry.register(new MethodRuntimeEnricher());
    expect(registry.hasEnricher(AntipatternType.GGD)).toBe(true);
    expect(registry.hasEnricher(AntipatternType.SOQL_NO_WHERE_LIMIT)).toBe(false);
  });

  it("should return registered types", () => {
    const registry = new RuntimeEnricherRegistry();
    registry.register(new MethodRuntimeEnricher());
    registry.register(new SOQLRuntimeEnricher());
    const types = registry.getRegisteredTypes();
    expect(types).toContain(AntipatternType.GGD);
    expect(types).toContain(AntipatternType.SOQL_NO_WHERE_LIMIT);
    expect(types).toContain(AntipatternType.SOQL_UNUSED_FIELDS);
    expect(types).toHaveLength(3);
  });
});
