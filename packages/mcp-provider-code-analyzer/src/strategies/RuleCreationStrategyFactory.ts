import { IRuleCreationStrategy } from "./IRuleCreationStrategy.js";
import { XPathRuleStrategy } from "./XPathRuleStrategy.js";
import { RegexRuleStrategy } from "./RegexRuleStrategy.js";

/**
 * Factory for creating rule creation strategies based on engine type.
 * Supports dynamic strategy registration and retrieval.
 */
export class RuleCreationStrategyFactory {
  private readonly strategies: Map<string, IRuleCreationStrategy>;

  constructor() {
    this.strategies = new Map();

    // Register default strategies
    this.registerStrategy(new XPathRuleStrategy());
    this.registerStrategy(new RegexRuleStrategy());
  }

  /**
   * Register a new strategy
   */
  public registerStrategy(strategy: IRuleCreationStrategy): void {
    const engine = strategy.getSupportedEngine().toLowerCase();
    this.strategies.set(engine, strategy);
  }

  /**
   * Get strategy for the specified engine
   * @throws Error if engine is not supported
   */
  public createStrategy(engine: string): IRuleCreationStrategy {
    const normalizedEngine = engine.toLowerCase().trim();
    const strategy = this.strategies.get(normalizedEngine);

    if (!strategy) {
      const supportedEngines = this.getSupportedEngines().join(", ");
      throw new Error(
        `Unsupported engine: '${engine}'. Supported engines: ${supportedEngines}`
      );
    }

    return strategy;
  }

  /**
   * Get list of all supported engine names
   */
  public getSupportedEngines(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if an engine is supported
   */
  public isEngineSupported(engine: string): boolean {
    return this.strategies.has(engine.toLowerCase().trim());
  }
}
