import { describe, expect, it, vi } from "vitest";

const nestedIfXml = `
<CompilationUnit>
  <ClassDeclaration Name="NestedIfExample">
    <MethodDeclaration Name="checkDepth">
      <IfStatement>
        <IfStatement>
          <IfStatement>
            <IfStatement>
              <MethodCall Name="System.debug" />
            </IfStatement>
          </IfStatement>
        </IfStatement>
      </IfStatement>
    </MethodDeclaration>
  </ClassDeclaration>
</CompilationUnit>
`.trim();

const hardcodedIdXml = `
<CompilationUnit>
  <ClassDeclaration Name="HardcodedIdLengthExample">
    <MethodDeclaration Name="doWork">
      <VariableDeclaration Name="contactId">
        <LiteralExpression Image="0035g00000ABCDEFXYZ" />
      </VariableDeclaration>
      <VariableDeclaration Name="cId">
        <LiteralExpression Image="0039A00000ZZZZZQAA" />
      </VariableDeclaration>
      <IfStatement>
        <MethodCall Name="startsWith" />
      </IfStatement>
      <VariableDeclaration Name="soql">
        <LiteralExpression Image="SELECT Id FROM Contact WHERE Id = '0038X00001ABCDEFGH'" />
      </VariableDeclaration>
    </MethodDeclaration>
  </ClassDeclaration>
</CompilationUnit>
`.trim();

const generateAstXmlFromSourceMock = vi.fn()
  .mockResolvedValueOnce(nestedIfXml)
  .mockResolvedValueOnce(hardcodedIdXml);

vi.mock("../../src/ast/generate-ast-xml.js", () => ({
  generateAstXmlFromSource: generateAstXmlFromSourceMock
}));

describe("GetAstNodesActionImpl", () => {
  it("generates AST nodes from sample Apex code", async () => {
    const { GetAstNodesActionImpl } = await import("../../src/actions/get-ast-nodes.js");
    const action = new GetAstNodesActionImpl();

    const input = {
      sampleCode: "public with sharing class NestedIfExample {\n    public static void checkDepth(Integer a, Integer b, Integer c, Integer d) {\n        if (a > 0) {\n            if (b > 0) {\n                if (c > 0) {\n                    if (d > 0) {\n                        System.debug('Depth 4: violation');\n                    }\n                }\n            }\n        }\n    }\n}",
      language: "apex",
      engine: "pmd"
    };

    const result = await action.exec({
      code: input.sampleCode,
      language: input.language
    });

    expect(generateAstXmlFromSourceMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it("generates AST nodes for hardcoded Id example", async () => {
    const { GetAstNodesActionImpl } = await import("../../src/actions/get-ast-nodes.js");
    const action = new GetAstNodesActionImpl();

    const input = {
      sampleCode: "public class HardcodedIdLengthExample {\n    public void doWork() {\n        // Violations to target: starts with 003 and length > 15 (18-char Id)\n        String contactId = '0035g00000ABCDEFXYZ'; // 18 chars, starts with 003\n        Id cId = '0039A00000ZZZZZQAA';           // 18 chars, starts with 003\n        // Additional representative contexts\n        if ('0032K00001ABCDEFGH'.startsWith('003')) { /* ... */ }\n        String soql = 'SELECT Id FROM Contact WHERE Id = \\'0038X00001ABCDEFGH\\''; // embedded in string\n    }\n}\n",
      language: "apex",
      engine: "pmd"
    };

    const result = await action.exec({
      code: input.sampleCode,
      language: input.language
    });

    expect(result.status).toBe("success");
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it("returns an error status when the pipeline throws", async () => {
    vi.resetModules();
    vi.doMock("../../src/ast/ast-node-pipeline.js", () => ({
      PmdAstNodePipeline: class {
        public async run(): Promise<never> {
          throw new Error("boom");
        }
      }
    }));

    const { GetAstNodesActionImpl } = await import("../../src/actions/get-ast-nodes.js");
    const action = new GetAstNodesActionImpl();

    const result = await action.exec({
      code: "class X {}",
      language: "apex"
    });

    expect(result.status).toBe("boom");
    expect(result.nodes).toEqual([]);
    expect(result.metadata).toEqual([]);
  });

  it("falls back to string error when non-Error is thrown", async () => {
    vi.resetModules();
    vi.doMock("../../src/ast/ast-node-pipeline.js", () => ({
      PmdAstNodePipeline: class {
        public async run(): Promise<never> {
          throw "boom-string";
        }
      }
    }));

    const { GetAstNodesActionImpl } = await import("../../src/actions/get-ast-nodes.js");
    const action = new GetAstNodesActionImpl();

    const result = await action.exec({
      code: "class X {}",
      language: "apex"
    });

    expect(result.status).toBe("boom-string");
    expect(result.nodes).toEqual([]);
    expect(result.metadata).toEqual([]);
  });
});
