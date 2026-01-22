/**
 * Runtime Enricher Registry
 * 
 * Manages registration and lookup of runtime enrichers by antipattern type.
 * Provides centralized access to all registered enrichers.
 */

import { BaseRuntimeEnricher } from "./base-runtime-enricher.js";
import { AntipatternType } from "../models/antipattern-type.js";

/**
 * Registry for managing runtime enrichers
 * Maps antipattern types to their corresponding enrichers
 */
export class RuntimeEnricherRegistry {
  private enrichers: Map<AntipatternType, BaseRuntimeEnricher> = new Map();

  /**
   * Registers a runtime enricher for its supported antipattern types
   * 
   * @param enricher - The runtime enricher to register
   */
  public register(enricher: BaseRuntimeEnricher): void {
    for (const type of enricher.getAntipatternTypes()) {
      this.enrichers.set(type, enricher);
    }
  }

  /**
   * Gets a runtime enricher for a specific antipattern type
   * 
   * @param type - The antipattern type to look up
   * @returns The enricher instance or undefined if not found
   */
  public getRuntimeEnricher(type: AntipatternType): BaseRuntimeEnricher | undefined {
    return this.enrichers.get(type);
  }

  /**
   * Gets all registered enrichers (unique instances)
   * 
   * @returns Array of all registered enricher instances
   */
  public getAllEnrichers(): BaseRuntimeEnricher[] {
    // Use Set to deduplicate since one enricher can handle multiple types
    return Array.from(new Set(this.enrichers.values()));
  }

  /**
   * Checks if an enricher is registered for a specific antipattern type
   * 
   * @param type - The antipattern type to check
   * @returns true if an enricher is registered for this type
   */
  public hasEnricher(type: AntipatternType): boolean {
    return this.enrichers.has(type);
  }

  /**
   * Gets all antipattern types that have registered enrichers
   * 
   * @returns Array of antipattern types with registered enrichers
   */
  public getRegisteredTypes(): AntipatternType[] {
    return Array.from(this.enrichers.keys());
  }
}

