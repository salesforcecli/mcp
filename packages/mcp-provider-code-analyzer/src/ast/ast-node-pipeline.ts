import { extractAstNodesFromXml, type AstNode } from "./extract-ast-nodes.js";
import { type AstNodeMetadata } from "./metadata/pmd-ast-reference.js";
import { getEngineStrategy } from "../engines/engine-strategies.js";

// Template Method pipeline for AST XML -> nodes -> metadata.
export type AstPipelineInput = {
  code: string;
  language: string;
};

export type AstPipelineOutput = {
  nodes: AstNode[];
  metadata: AstNodeMetadata[];
};

export abstract class AstNodePipeline {
  public async run(input: AstPipelineInput): Promise<AstPipelineOutput> {
    const astXml = await this.generateAstXml(input);
    const nodes = this.extractNodes(astXml);
    const metadata = await this.enrichMetadata(input, nodes);
    return { nodes, metadata };
  }

  protected abstract generateAstXml(input: AstPipelineInput): Promise<string>;

  protected extractNodes(astXml: string): AstNode[] {
    return extractAstNodesFromXml(astXml);
  }

  protected async enrichMetadata(
    _input: AstPipelineInput,
    _nodes: AstNode[]
  ): Promise<AstNodeMetadata[]> {
    return [];
  }
}

export class PmdAstNodePipeline extends AstNodePipeline {
  private readonly strategy = getEngineStrategy("pmd");

  protected async generateAstXml(input: AstPipelineInput): Promise<string> {
    return this.strategy.astGenerator.generateAstXml(input.code, input.language);
  }

  protected async enrichMetadata(
    input: AstPipelineInput,
    nodes: AstNode[]
  ): Promise<AstNodeMetadata[]> {
    const nodeNames = Array.from(new Set(nodes.map((node) => node.nodeName)));
    return this.strategy.metadataProvider.getMetadata(input.language, nodeNames);
  }
}
