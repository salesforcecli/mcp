/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import { updateWorkItemStatus, type WorkItemStatus } from "../updateWorkItemStatus.js";
import { TelemetryEventNames } from "../constants.js";
import { usernameOrAliasParam } from "../shared/params.js";

const statusEnum = z.enum(["In Progress", "Ready to Promote"]);

const inputSchema = z.object({
  usernameOrAlias: usernameOrAliasParam,
  workItemName: z.string().min(1).describe("Exact Work Item Name to update (e.g. WI-00000001)."),
  status: statusEnum.describe("New status: 'In Progress' or 'Ready to Promote'"),
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsUpdateWorkItemStatus extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly services: Services;

  constructor(services: Services) {
    super();
    this.services = services;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DEVOPS];
  }

  public getName(): string {
    return "update_devops_center_work_item_status";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Update Work Item Status",
      description: `Update the status of a DevOps Center work item to either "In Progress" or "Ready to Promote".

      **Use when user asks (examples):**
      - "Mark WI-123 In Progress"
      - "Set work item WI-456 to Ready to Promote"
      - "Change work item status to In Progress"
      - "Mark my work item as Ready to Promote"

      **Prerequisites:**
      - This tool must be used only for the DevOps Center org.
      - The user must provide: username (DevOps Center), Work Item Name, and the desired status.

      **Input Parameters:**
      - usernameOrAlias: DevOps Center org username or alias. If missing, use 'list_all_orgs' and ask user to select the DevOps Center org.
      - workItemName: Exact Work Item Name (e.g. WI-00000001).
      - status: New status - either "In Progress" or "Ready to Promote".

      **Output:**
      - success: Whether the update succeeded.
      - workItemId, workItemName, status: Updated work item details on success.
      - error: Error message if the work item was not found or update failed.

      **Next steps:**
      - After marking "Ready to Promote", suggest promoting the work item (using 'promote_devops_center_work_item') when appropriate.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: false, // Updates work item status (modifies state)
        destructiveHint: false, // Does not delete anything
        openWorldHint: true, // Calls Salesforce DevOps Center API
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      const result = await updateWorkItemStatus(
        input.usernameOrAlias,
        input.workItemName,
        input.status as WorkItemStatus
      );

      const executionTime = Date.now() - startTime;

      this.services.getTelemetryService().sendEvent(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS, {
        success: result.success,
        workItemName: input.workItemName,
        status: input.status,
        executionTimeMs: executionTime,
        ...(result.error && { error: result.error }),
      });

      if (!result.success) {
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e: any) {
      const executionTime = Date.now() - startTime;

      this.services.getTelemetryService().sendEvent(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS, {
        success: false,
        error: e?.message || "Unknown error",
        workItemName: input.workItemName,
        executionTimeMs: executionTime,
      });

      return {
        content: [{ type: "text", text: `Error updating work item status: ${e?.message || e}` }],
        isError: true,
      };
    }
  }
}
