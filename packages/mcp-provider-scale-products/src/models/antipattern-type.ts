/**
 * Enum representing different types of antipatterns that can be detected
 */
export enum AntipatternType {
  /**
   * Schema.getGlobalDescribe() antipattern
   * Detects usage of the expensive getGlobalDescribe() method
   */
  GGD = "GGD",
}
