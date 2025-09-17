import { SfDevopsListOrgsMcpTool } from "../../src/tools/sf-devops-list-orgs.js";

describe("Tests for SfDevopsListOrgsMcpTool", () => {
  let tool: SfDevopsListOrgsMcpTool;

  beforeEach(() => {
    tool = new SfDevopsListOrgsMcpTool();
  });

  it("When getName is called, then 'sf-devopslist-orgs' is returned", () => {
    expect(tool.getName()).toEqual("sf-devopslist-orgs");
  });

  it("When getConfig is called, then the config contains the expected properties", () => {
    const config = tool.getConfig();
    expect(config.title).toEqual("List Salesforce DevOps Orgs");
    expect(config.description).toContain("Lists all Salesforce orgs");
    expect(config.annotations?.readOnlyHint).toBe(true);
  });
});
