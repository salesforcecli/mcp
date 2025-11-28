import { ApexParserFactory, ApexParserBaseVisitor } from "@apexdevtools/apex-parser";
import type {
  MethodDeclarationContext,
  ForStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
  ClassDeclarationContext,
  DotMethodCallContext,
  QueryContext,
  InsertStatementContext,
  UpdateStatementContext,
  DeleteStatementContext,
  UpsertStatementContext,
} from "@apexdevtools/apex-parser";

/**
 * Information about a method declaration
 */
export interface MethodInfo {
  name: string;
  lineNumber: number;
  modifiers: string[];
  returnType?: string;
}

/**
 * Information about a loop statement
 */
export interface LoopInfo {
  type: "for" | "while" | "do-while";
  lineNumber: number;
  code: string;
}

/**
 * Information about a method call
 */
export interface MethodCallInfo {
  methodName: string;
  receiver?: string;
  lineNumber: number;
  code: string;
}

/**
 * Information about a SOQL query
 */
export interface QueryInfo {
  lineNumber: number;
  query: string;
}

/**
 * Information about a DML statement
 */
export interface DMLInfo {
  type: "insert" | "update" | "delete" | "upsert";
  lineNumber: number;
  code: string;
}

/**
 * Information about a class declaration
 */
export interface ClassInfo {
  name: string;
  lineNumber: number;
  modifiers: string[];
}

/**
 * Utility class for common Apex AST parsing operations
 */
export class ApexAstUtils {
  /**
   * Get all method declarations from Apex code
   */
  public static getAllMethods(apexCode: string): MethodInfo[] {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new MethodCollectorVisitor();
      visitor.visit(compilationUnit);
      
      return visitor.methods;
    } catch (error) {
      console.error("Error parsing Apex code for methods:", error);
      return [];
    }
  }

  /**
   * Get all loop statements from Apex code
   */
  public static getAllLoops(apexCode: string): LoopInfo[] {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new LoopCollectorVisitor(apexCode);
      visitor.visit(compilationUnit);
      
      return visitor.loops;
    } catch (error) {
      console.error("Error parsing Apex code for loops:", error);
      return [];
    }
  }

  /**
   * Get all method calls from Apex code
   */
  public static getAllMethodCalls(apexCode: string): MethodCallInfo[] {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new MethodCallCollectorVisitor(apexCode);
      visitor.visit(compilationUnit);
      
      return visitor.methodCalls;
    } catch (error) {
      console.error("Error parsing Apex code for method calls:", error);
      return [];
    }
  }

  /**
   * Get all SOQL queries from Apex code
   */
  public static getAllQueries(apexCode: string): QueryInfo[] {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new QueryCollectorVisitor();
      visitor.visit(compilationUnit);
      
      return visitor.queries;
    } catch (error) {
      console.error("Error parsing Apex code for queries:", error);
      return [];
    }
  }

  /**
   * Get all DML statements from Apex code
   */
  public static getAllDMLStatements(apexCode: string): DMLInfo[] {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new DMLCollectorVisitor(apexCode);
      visitor.visit(compilationUnit);
      
      return visitor.dmlStatements;
    } catch (error) {
      console.error("Error parsing Apex code for DML:", error);
      return [];
    }
  }

  /**
   * Get class information from Apex code
   */
  public static getClassInfo(apexCode: string): ClassInfo | null {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new ClassInfoVisitor();
      visitor.visit(compilationUnit);
      
      return visitor.classInfo;
    } catch (error) {
      console.error("Error parsing Apex code for class info:", error);
      return null;
    }
  }

  /**
   * Check if Apex code is syntactically valid
   */
  public static isValidApex(apexCode: string): boolean {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      return compilationUnit !== null;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Visitor to collect all method declarations
 */
class MethodCollectorVisitor extends ApexParserBaseVisitor<void> {
  public methods: MethodInfo[] = [];

  visitMethodDeclaration(ctx: any): void {
    // Try to get method name from id() first
    let name = "unknown";
    if (ctx.id) {
      const idCtx = ctx.id();
      const idText = idCtx ? idCtx.getText() : undefined;
      if (idText) {
        name = idText;
      }
    }
    
    // Fallback: if id() returns empty or undefined, extract from FormalParametersContext  
    // Parser behavior is inconsistent - sometimes puts name in id(), sometimes in parameters
    if (name === "unknown" && ctx.getChildCount() > 0) {
      for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        if (child && child.constructor.name === "FormalParametersContext") {
          // Extract method name from parameters text (e.g., "testMethod()")
          const text = child.getText();
          const match = text.match(/^(\w+)\(/);
          if (match) {
            name = match[1];
            break;
          }
        }
      }
    }
    
    const lineNumber = ctx.start ? ctx.start.line : 0;
    
    // Get modifiers (public, private, static, etc.)
    const modifiers: string[] = [];
    let parent = ctx.parentCtx;
    while (parent) {
      if (parent.constructor.name === "MemberDeclarationContext") {
        // Walk up to find modifiers
        let modParent = parent.parentCtx;
        if (modParent?.constructor.name === "ClassBodyDeclarationContext") {
          // Get modifier children
          for (let i = 0; i < modParent.getChildCount(); i++) {
            const child = modParent.getChild(i);
            if (child?.constructor.name === "ModifierContext") {
              modifiers.push(child.getText().toLowerCase());
            }
          }
        }
        break;
      }
      parent = parent.parentCtx;
    }

    // Get return type - try typeRef() method
    let returnType: string | undefined;
    if (ctx.typeRef) {
      const typeRef = ctx.typeRef();
      returnType = typeRef ? typeRef.getText() : undefined;
    }
    
    // If no typeRef, scan children for type
    if (!returnType && ctx.getChildCount() > 0) {
      for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        const childName = child?.constructor?.name;
        if (childName === "TypeRefContext" || childName === "VoidContext") {
          returnType = child.getText();
          break;
        }
      }
    }

    this.methods.push({
      name,
      lineNumber,
      modifiers,
      returnType,
    });

    this.visitChildren(ctx);
  }
}

/**
 * Visitor to collect all loop statements
 */
class LoopCollectorVisitor extends ApexParserBaseVisitor<void> {
  public loops: LoopInfo[] = [];

  constructor(private apexCode: string) {
    super();
  }

  visitForStatement(ctx: ForStatementContext): void {
    this.loops.push({
      type: "for",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }

  visitWhileStatement(ctx: WhileStatementContext): void {
    this.loops.push({
      type: "while",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }

  visitDoWhileStatement(ctx: DoWhileStatementContext): void {
    this.loops.push({
      type: "do-while",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }
}

/**
 * Visitor to collect all method calls
 */
class MethodCallCollectorVisitor extends ApexParserBaseVisitor<void> {
  public methodCalls: MethodCallInfo[] = [];

  constructor(private apexCode: string) {
    super();
  }

  visitDotMethodCall(ctx: DotMethodCallContext): void {
    const anyId = ctx.anyId();
    const methodName = anyId ? anyId.getText() : "unknown";
    const lineNumber = ctx.start ? ctx.start.line : 0;
    
    // Get receiver from parent DotExpression
    let receiver: string | undefined;
    let parent = ctx.parentCtx;
    while (parent) {
      if (parent.constructor.name === "DotExpressionContext") {
        const fullText = parent.getText();
        // Extract receiver (everything before the last dot and method call)
        const methodCallText = ctx.getText();
        receiver = fullText.substring(0, fullText.lastIndexOf(methodCallText)).replace(/\.$/, "");
        break;
      }
      parent = parent.parentCtx;
    }

    this.methodCalls.push({
      methodName,
      receiver,
      lineNumber,
      code: ctx.getText(),
    });

    this.visitChildren(ctx);
  }
}

/**
 * Visitor to collect all SOQL queries
 */
class QueryCollectorVisitor extends ApexParserBaseVisitor<void> {
  public queries: QueryInfo[] = [];

  visitQuery(ctx: QueryContext): void {
    this.queries.push({
      lineNumber: ctx.start ? ctx.start.line : 0,
      query: ctx.getText(),
    });
    this.visitChildren(ctx);
  }
}

/**
 * Visitor to collect all DML statements
 */
class DMLCollectorVisitor extends ApexParserBaseVisitor<void> {
  public dmlStatements: DMLInfo[] = [];

  constructor(private apexCode: string) {
    super();
  }

  visitInsertStatement(ctx: InsertStatementContext): void {
    this.dmlStatements.push({
      type: "insert",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }

  visitUpdateStatement(ctx: UpdateStatementContext): void {
    this.dmlStatements.push({
      type: "update",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }

  visitDeleteStatement(ctx: DeleteStatementContext): void {
    this.dmlStatements.push({
      type: "delete",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }

  visitUpsertStatement(ctx: UpsertStatementContext): void {
    this.dmlStatements.push({
      type: "upsert",
      lineNumber: ctx.start ? ctx.start.line : 0,
      code: ctx.getText(),
    });
    this.visitChildren(ctx);
  }
}

/**
 * Visitor to collect class information
 */
class ClassInfoVisitor extends ApexParserBaseVisitor<void> {
  public classInfo: ClassInfo | null = null;

  visitClassDeclaration(ctx: ClassDeclarationContext): void {
    if (this.classInfo) return; // Only get the first/main class

    const idCtx = ctx.id();
    const name = idCtx ? idCtx.getText() : "unknown";
    const lineNumber = ctx.start ? ctx.start.line : 0;

    const modifiers: string[] = [];
    let parent = ctx.parentCtx;
    while (parent) {
      if (parent.constructor.name === "TypeDeclarationContext") {
        // Get modifiers from parent
        let modParent = parent.parentCtx;
        if (modParent?.constructor.name === "CompilationUnitContext") {
          // Look for modifiers as siblings in the type declaration
          for (let i = 0; i < parent.getChildCount(); i++) {
            const child = parent.getChild(i);
            if (child?.constructor.name === "ModifierContext") {
              modifiers.push(child.getText().toLowerCase());
            }
          }
        }
        break;
      }
      parent = parent.parentCtx;
    }

    this.classInfo = {
      name,
      lineNumber,
      modifiers,
    };

    this.visitChildren(ctx);
  }
}
