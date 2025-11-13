/**
 * AST Analyzer Utility
 * Sophisticated AST analysis and variable tracking logic
 * 
 * This is the CRITICAL component that implements:
 * - 2-line distance rule for variable assignments
 * - Special handling for FOR loops
 * - Variable reference tracking
 * - Return statement detection
 * - Class member field detection
 */

/**
 * Represents a variable reference in the AST
 */
export interface VariableReference {
  varName: string;
  lineNumber: number;
  type: 'declaration' | 'assignment' | 'access' | 'memberAccess';
  fieldAccessed?: string;
  context?: string;
}

/**
 * Represents a SOQL query found in the AST
 */
export interface SOQLQueryInfo {
  query: string;
  lineNumber: number;
  endLineNumber: number;
  assignedVariable?: string;
  isInLoop: boolean;
  fields?: string[];
  methodName?: string;
}

/**
 * AST Analyzer for traversing and analyzing Apex AST
 * Implements sophisticated analysis patterns
 */
export class ASTAnalyzer {
  /**
   * CRITICAL: Find SOQL assigned variables with 2-line distance rule and FOR loop handling
   * 
   * This implements the core pattern:
   * 1. Track candidate variables as we traverse AST
   * 2. When we hit a SOQL, check if candidate is within 2 lines
   * 3. Special case: FOR loops use the loop variable
   * 
   * @param soqlNodes - Array of SOQL AST nodes
   * @param ast - The full AST to traverse
   * @returns Map of SOQL line numbers to assigned variable names
   * 
   * @example
   * // Code: Account acc = [SELECT Id FROM Account];
   * // Returns: Map { 10 => "acc" }
   * 
   * // Code: for (Account acc : [SELECT Id FROM Account]) {}
   * // Returns: Map { 15 => "acc" } (loop variable)
   */
  public static findSOQLAssignedVariable(
    soqlNodes: SOQLQueryInfo[],
    ast: any
  ): Map<number, string | null> {
    const soqlLine2AssignedVar = new Map<number, string | null>();
    let candidateAssignedVariable: any = null;

    // Traverse AST in order (CRITICAL for accurate tracking)
    const allNodes = this.traverseAST(ast);

    for (const node of allNodes) {
      // Track variable declarations and assignments as candidates
      if (this.isVariableNode(node)) {
        candidateAssignedVariable = node;
      }

      // Found SOQL expression
      if (this.isSOQLNode(node)) {
        const soqlLineNumber = node.location?.startLine || node.location?.line || 0;

        // CRITICAL: Special handling for FOR loops
        if (this.isInForLoop(node)) {
          const loopVar = this.findForLoopVariable(node);
          if (loopVar) {
            candidateAssignedVariable = loopVar;
          }
        }

        // CRITICAL: 2-line distance rule
        if (candidateAssignedVariable) {
          const candidateLine = candidateAssignedVariable.location?.startLine || 
                                candidateAssignedVariable.location?.line || 0;
          const distance = soqlLineNumber - candidateLine;

          if (distance > 2) {
            // Too far away, not the assigned variable
            soqlLine2AssignedVar.set(soqlLineNumber, null);
          } else {
            // Within 2 lines, this is the assigned variable
            const varName = this.extractVariableName(candidateAssignedVariable);
            soqlLine2AssignedVar.set(soqlLineNumber, varName);
          }
        } else {
          soqlLine2AssignedVar.set(soqlLineNumber, null);
        }

        // Reset candidate after processing SOQL
        candidateAssignedVariable = null;
      }
    }

    return soqlLine2AssignedVar;
  }

  /**
   * CRITICAL: Extract FOR loop variable (special case)
   * In FOR loops, the loop variable is the assigned variable, not the line before
   * 
   * @param soqlNode - The SOQL AST node
   * @returns The loop variable node or null
   */
  private static findForLoopVariable(soqlNode: any): any | null {
    // Walk up to find the ForEachStatement parent
    let parent = soqlNode.parent || this.findParent(soqlNode);
    
    while (parent) {
      if (parent.$ === 'ForEachStatement' || parent.type === 'ForEachStatement') {
        // Found the for loop, now find its loop variable
        const children = parent.children || parent.statements || [];
        for (const child of children) {
          if (this.isVariableNode(child)) {
            return child;
          }
        }
      }
      parent = parent.parent;
    }
    
    return null;
  }

  /**
   * Find all variable references after a specific line
   * Used to track how variables are used after SOQL assignment
   * 
   * @param varName - Variable name to search for
   * @param afterLine - Only find references after this line
   * @param ast - The AST to search
   * @returns Array of variable references
   */
  public static findVariableReferences(
    varName: string,
    afterLine: number,
    ast: any
  ): VariableReference[] {
    const references: VariableReference[] = [];
    const nodes = this.traverseAST(ast);

    for (const node of nodes) {
      const nodeLine = node.location?.startLine || node.location?.line || 0;
      
      if (nodeLine <= afterLine) continue;

      const currentVarName = this.extractVariableName(node);
      
      if (currentVarName === varName) {
        const ref: VariableReference = {
          varName,
          lineNumber: nodeLine,
          type: 'access',
        };

        // Check for member access (e.g., acc.Name)
        if (this.isMemberAccess(node)) {
          ref.type = 'memberAccess';
          const memberName = this.extractMemberName(node);
          ref.fieldAccessed = memberName ?? undefined;
        }

        references.push(ref);
      }
    }

    return references;
  }

  /**
   * CRITICAL: Check if variable is returned (exclusion rule)
   * If a variable is returned, we cannot safely optimize it
   * 
   * @param varName - Variable name to check
   * @param ast - The AST to search
   * @returns true if variable is returned
   */
  public static isVariableReturned(varName: string, ast: any): boolean {
    const nodes = this.traverseAST(ast);

    for (const node of nodes) {
      if (this.isReturnStatement(node)) {
        const returnedVar = this.extractReturnedVariable(node);
        if (returnedVar === varName) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if variable is a class member field
   * Class members are harder to analyze, so we skip them
   * 
   * @param varName - Variable name to check
   * @param classAST - The class-level AST
   * @returns true if it's a class member
   */
  public static isClassMember(varName: string, classAST: any): boolean {
    const fields = this.getClassFields(classAST);
    return fields.includes(varName);
  }

  /**
   * Get all class-level field names
   * Used for exclusion logic
   * 
   * @param classAST - The class AST
   * @returns Array of field names
   */
  public static getClassFields(classAST: any): string[] {
    const fields: string[] = [];
    const nodes = this.traverseAST(classAST);

    for (const node of nodes) {
      if (this.isFieldDeclaration(node)) {
        const fieldName = this.extractVariableName(node);
        if (fieldName) {
          fields.push(fieldName);
        }
      }
    }

    return fields;
  }

  /**
   * Check if SOQL is inside a loop
   * Important for severity and metadata
   * 
   * @param soqlNode - The SOQL AST node
   * @returns true if inside a loop
   */
  public static isInLoop(soqlNode: any): boolean {
    return this.isInForLoop(soqlNode) || this.isInWhileLoop(soqlNode);
  }

  /**
   * Traverse AST depth-first
   * Returns all nodes in traversal order
   * 
   * @param ast - Root AST node
   * @returns Array of all nodes
   */
  private static traverseAST(ast: any): any[] {
    const nodes: any[] = [];
    
    const traverse = (node: any) => {
      if (!node) return;
      
      nodes.push(node);
      
      // Handle different AST structures
      const children = node.children || node.statements || node.body || [];
      if (Array.isArray(children)) {
        children.forEach(traverse);
      }
      
      // Handle other possible child properties
      if (node.expression) traverse(node.expression);
      if (node.condition) traverse(node.condition);
      if (node.initializer) traverse(node.initializer);
    };
    
    traverse(ast);
    return nodes;
  }

  /**
   * Helper: Check if node is a variable declaration or expression
   */
  private static isVariableNode(node: any): boolean {
    const type = node.$ || node.type || '';
    return type === 'VariableDeclaration' || 
           type === 'VariableExpression' ||
           type === 'LocalVariableDeclaration' ||
           type.includes('Variable');
  }

  /**
   * Helper: Check if node is a SOQL expression
   */
  private static isSOQLNode(node: any): boolean {
    const type = node.$ || node.type || '';
    return type === 'SoqlExpression' || 
           type === 'SOQLExpression' ||
           type.includes('Soql');
  }

  /**
   * Helper: Check if node is in a FOR loop
   */
  private static isInForLoop(node: any): boolean {
    let parent = node.parent;
    while (parent) {
      const type = parent.$ || parent.type || '';
      if (type === 'ForEachStatement' || type.includes('ForEach')) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Helper: Check if node is in a WHILE loop
   */
  private static isInWhileLoop(node: any): boolean {
    let parent = node.parent;
    while (parent) {
      const type = parent.$ || parent.type || '';
      if (type === 'WhileStatement' || type.includes('While')) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Helper: Check if node is a return statement
   */
  private static isReturnStatement(node: any): boolean {
    const type = node.$ || node.type || '';
    return type === 'ReturnStatement' || type.includes('Return');
  }

  /**
   * Helper: Check if node is a field declaration
   */
  private static isFieldDeclaration(node: any): boolean {
    const type = node.$ || node.type || '';
    return type === 'FieldDeclaration' || type.includes('Field');
  }

  /**
   * Helper: Check if node is a member access (e.g., acc.Name)
   */
  private static isMemberAccess(node: any): boolean {
    const parent = node.parent;
    if (!parent) return false;
    const type = parent.$ || parent.type || '';
    return type === 'MemberAccess' || type.includes('Member');
  }

  /**
   * Helper: Extract variable name from node
   */
  private static extractVariableName(node: any): string | null {
    return node.name || node.id?.name || node.identifier || null;
  }

  /**
   * Helper: Extract member name from member access
   */
  private static extractMemberName(node: any): string | null {
    const parent = node.parent;
    if (!parent) return null;
    return parent.memberName || parent.member || parent.property?.name || null;
  }

  /**
   * Helper: Extract returned variable from return statement
   */
  private static extractReturnedVariable(node: any): string | null {
    const expr = node.expression || node.value;
    if (!expr) return null;
    return this.extractVariableName(expr);
  }

  /**
   * Helper: Find parent node (when parent property not set)
   */
  private static findParent(node: any): any | null {
    // This would need to be implemented based on how AST is structured
    // For now, return null if parent property doesn't exist
    return null;
  }
}

