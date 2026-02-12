import { describe, expect, it } from "vitest";

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

    expect(result.status).toBe("success");
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.nodes[0]?.nodeName).toBe("CompilationUnit");
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
});
