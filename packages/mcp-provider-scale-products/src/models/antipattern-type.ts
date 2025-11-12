/**
 * Enum representing different types of antipatterns that can be detected
 */
export enum AntipatternType {
  /**
   * Schema.getGlobalDescribe() antipattern
   * Detects usage of the expensive getGlobalDescribe() method
   */
  GGD = "GGD",
  
  /**
   * SOQL without WHERE or LIMIT clause antipattern
   * Detects SOQL queries that lack WHERE or LIMIT clauses
   */
  SOQL_NO_WHERE_LIMIT = "SOQL_NO_WHERE_LIMIT",
}
