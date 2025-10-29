import { AntipatternModule } from "./antipattern-module.js";
import { AntipatternType } from "../models/antipattern-type.js";

/**
 * Registry for managing antipattern modules
 * Provides a centralized way to access all registered antipattern scanners
 */
export class AntipatternRegistry {
  private modules: Map<AntipatternType, AntipatternModule> = new Map();

  /**
   * Registers an antipattern module
   * @param module - The antipattern module to register
   */
  public register(module: AntipatternModule): void {
    this.modules.set(module.getAntipatternType(), module);
  }

  /**
   * Gets a module for a specific antipattern type
   * @param type - The antipattern type
   * @returns The module instance or undefined if not found
   */
  public getModule(type: AntipatternType): AntipatternModule | undefined {
    return this.modules.get(type);
  }

  /**
   * Gets all registered modules
   * @returns Array of all registered module instances
   */
  public getAllModules(): AntipatternModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Gets all registered antipattern types
   * @returns Array of all registered antipattern type names
   */
  public getRegisteredTypes(): AntipatternType[] {
    return Array.from(this.modules.keys());
  }
}
