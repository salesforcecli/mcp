import { describe, expect, it, vi } from "vitest";

const sampleXml = `
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

const generateAstXmlFromSourceMock = vi.fn().mockResolvedValue(sampleXml);

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
    console.log(result.nodes);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.nodes[0]?.nodeName).toBe("CompilationUnit");
  });
});
