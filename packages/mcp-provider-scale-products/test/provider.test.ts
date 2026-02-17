import { describe, it, expect } from "vitest";
import { ScaleProductsMcpProvider } from "../src/provider.js";
import { StubServices } from "./test-doubles.js";

describe("ScaleProductsMcpProvider", () => {
  it("should create provider instance", () => {
    const provider = new ScaleProductsMcpProvider();
    expect(provider).toBeDefined();
  });

  it("should return correct provider name", () => {
    const provider = new ScaleProductsMcpProvider();
    expect(provider.getName()).toBe("ScaleProductsMcpProvider");
  });

  it("should provide tools with telemetry service", async () => {
    const provider = new ScaleProductsMcpProvider();
    const services = new StubServices();
    
    const tools = await provider.provideTools(services);
    
    expect(tools).toBeDefined();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].getName()).toBe("scan_apex_class_for_antipatterns");
  });
});
