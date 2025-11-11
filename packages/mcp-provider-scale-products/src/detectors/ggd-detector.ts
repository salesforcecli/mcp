import { BaseDetector } from "./base-detector.js";
import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { Severity } from "../models/severity.js";
import { ApexParserFactory, ApexParserBaseVisitor } from "@apexdevtools/apex-parser";
import type {
  DotMethodCallContext,
  ForStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
  MethodDeclarationContext,
  DotExpressionContext,
} from "@apexdevtools/apex-parser";

/**
 * AST-based detector for Schema.getGlobalDescribe() antipattern
 * Uses apex-parser for accurate syntax tree analysis instead of regex
 */
export class GGDDetector implements BaseDetector {
  public getAntipatternType(): AntipatternType {
    return AntipatternType.GGD;
  }

  public detect(className: string, apexCode: string): DetectedAntipattern[] {
    const detections: DetectedAntipattern[] = [];

    try {
      // Create parser using the factory
      const parser = ApexParserFactory.createParser(apexCode);
      
      // Parse as a compilation unit (class file)
      const compilationUnit = parser.compilationUnit();

      // Create visitor to traverse the AST
      const visitor = new GGDVisitor(className, apexCode, detections);
      visitor.visit(compilationUnit);
    } catch (error) {
      console.error(`Error parsing ${className}:`, error);
    }

    return detections;
  }

}

/**
 * Visitor class to traverse the AST and detect getGlobalDescribe() calls
 */
class GGDVisitor extends ApexParserBaseVisitor<void> {
  private loopDepth = 0;
  private currentMethodName?: string;

  constructor(
    private className: string,
    private apexCode: string,
    private detections: DetectedAntipattern[]
  ) {
    super();
  }

  /**
   * Visit method declarations to track context
   */
  visitMethodDeclaration(ctx: any): void {
    // Save previous method name to handle nested contexts
    const previousMethodName = this.currentMethodName;
    
    // Try to get method name from id() first
    let methodName: string | undefined;
    if (ctx.id) {
      const idCtx = ctx.id();
      methodName = idCtx ? idCtx.getText() : undefined;
    }
    
    // Fallback: if id() returns empty or undefined, extract from FormalParametersContext
    // Parser behavior is inconsistent - sometimes puts name in id(), sometimes in parameters
    if (!methodName && ctx.getChildCount() > 0) {
      for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        if (child && child.constructor.name === "FormalParametersContext") {
          // Extract method name from parameters text (e.g., "testMethod()")
          const text = child.getText();
          const match = text.match(/^(\w+)\(/);
          if (match) {
            methodName = match[1];
            break;
          }
        }
      }
    }
    
    this.currentMethodName = methodName;
    
    // Continue traversing children - this will visit method body
    this.visitChildren(ctx);
    
    // Restore previous method name
    this.currentMethodName = previousMethodName;
  }

  /**
   * Visit for statements to track loop context
   */
  visitForStatement(ctx: ForStatementContext): void {
    this.loopDepth++;
    this.visitChildren(ctx);
    this.loopDepth--;
  }

  /**
   * Visit while statements to track loop context
   */
  visitWhileStatement(ctx: WhileStatementContext): void {
    this.loopDepth++;
    this.visitChildren(ctx);
    this.loopDepth--;
  }

  /**
   * Visit do-while statements to track loop context
   */
  visitDoWhileStatement(ctx: DoWhileStatementContext): void {
    this.loopDepth++;
    this.visitChildren(ctx);
    this.loopDepth--;
  }

  /**
   * Visit dot method calls - this is where we detect getGlobalDescribe()
   */
  visitDotMethodCall(ctx: DotMethodCallContext): void {
    // Check if this is a getGlobalDescribe() call
    const anyId = ctx.anyId();
    const methodName = anyId ? anyId.getText() : null;
    
    if (methodName === "getGlobalDescribe") {
      // Check if it's called on "Schema" by looking at parent DotExpression
      let parent = ctx.parentCtx;
      while (parent) {
        if (parent.constructor.name === "DotExpressionContext") {
          const fullExpression = parent.getText();
          
          // Check if the receiver is "Schema" (case-insensitive)
          if (fullExpression && fullExpression.toLowerCase().startsWith("schema.")) {
            const lineNumber = this.getLineNumber(ctx);
            const codeBefore = fullExpression.trim();
            const severity = this.loopDepth > 0 ? Severity.HIGH : Severity.MEDIUM;

            this.detections.push({
              className: this.className,
              methodName: this.currentMethodName,
              lineNumber,
              codeBefore,
              severity,
            });
          }
          break;
        }
        parent = parent.parentCtx;
      }
    }

    // Continue traversing children
    this.visitChildren(ctx);
  }

  /**
   * Extract line number from context
   */
  private getLineNumber(ctx: any): number {
    const token = ctx.start;
    return token ? token.line : 1;
  }

}
