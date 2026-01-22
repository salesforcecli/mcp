/**
 * Runtime Data Models
 * 
 * Type definitions for the Connect endpoint runtime data response.
 * Used for enriching antipattern detections with runtime metrics.
 */

/**
 * Entrypoint data from runtime metrics
 * Represents a specific code entry point with performance metrics
 */
export interface EntrypointData {
  /**
   * Name of the entrypoint (e.g., trigger name, batch class name)
   */
  entrypointName: string;

  /**
   * Average CPU time in milliseconds
   */
  avgCpuTime: number;

  /**
   * Average database time in milliseconds
   */
  avgDbTime: number;

  /**
   * Sum of CPU time across all executions
   */
  sumCpuTime: number;

  /**
   * Sum of database time across all executions
   */
  sumDbTime: number;
}

/**
 * Method runtime data
 * Contains performance metrics for a specific method, organized by entrypoints
 */
export interface MethodRuntimeData {
  /**
   * Name of the method
   */
  methodName: string;

  /**
   * Array of entrypoints that call this method with their metrics
   */
  entrypoints: EntrypointData[];
}

/**
 * SOQL query runtime data
 * Contains performance metrics for a specific SOQL query
 */
export interface SOQLRuntimeData {
  /**
   * Unique identifier for the query in format "ClassName.cls.LINE_NUMBER"
   */
  uniqueQueryIdentifier: string;

  /**
   * Number of times this query pattern was executed
   */
  representativeCount: number;

  /**
   * Total query execution time in milliseconds across all executions
   */
  totalQueryExecutionTime: number;
}

/**
 * Runtime data for a single Apex class
 * Contains both method-level and SOQL-level metrics
 */
export interface ClassRuntimeData {
  /**
   * Array of method runtime data (for method-based antipatterns like GGD)
   */
  methods: MethodRuntimeData[];

  /**
   * Array of SOQL query runtime data (for SOQL-based antipatterns)
   */
  soqlRuntimeData: SOQLRuntimeData[];
}

/**
 * Top-level runtime report from Connect endpoint
 */
export interface RuntimeReport {
  /**
   * Status of the API response
   */
  status: "SUCCESS" | "FAILURE";

  /**
   * Human-readable message about the response
   */
  message: string;

  /**
   * Map of class names to their runtime data
   */
  classData: Record<string, ClassRuntimeData>;
}

/**
 * Request payload for fetching runtime data
 */
export interface RuntimeDataRequest {
  /**
   * Unique identifier for this request (for tracking)
   */
  requestId: string;

  /**
   * Salesforce Org ID to fetch runtime data for
   */
  orgId: string;

  /**
   * Array of Apex class names to fetch runtime data for
   */
  classes: string[];
}

