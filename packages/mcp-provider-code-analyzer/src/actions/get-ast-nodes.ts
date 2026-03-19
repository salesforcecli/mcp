import { type AstNode } from "../ast/extract-ast-nodes.js";
import { type ApexAstNodeMetadata } from "../ast/metadata/apex-ast-reference.js";
import { PmdAstNodePipeline } from "../ast/ast-node-pipeline.js";

// Action that returns AST nodes plus cached metadata.
export type GetAstNodesInput = {
  code: string;
  language: string;
};

export type GetAstNodesOutput = {
  status: string;
  nodes: AstNode[];
  metadata: ApexAstNodeMetadata[];
};

export interface GetAstNodesAction {
  exec(input: GetAstNodesInput): Promise<GetAstNodesOutput>;
}

export class GetAstNodesActionImpl implements GetAstNodesAction {
  public async exec(input: GetAstNodesInput): Promise<GetAstNodesOutput> {
    try {
      const pipeline = new PmdAstNodePipeline();
      const { nodes, metadata } = await pipeline.run(input);
      return { status: "success", nodes, metadata };
    } catch (e) {
      return { status: (e as Error)?.message ?? String(e), nodes: [], metadata: [] };
    }
  }
}

