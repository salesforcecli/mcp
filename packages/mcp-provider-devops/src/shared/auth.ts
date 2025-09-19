import { AuthInfo, OrgAuthorization, Connection } from "@salesforce/core";
import { SanitizedOrgAuthorization } from "./types.js";

/**
 * Sanitizes org authorization data by filtering out sensitive fields
 *
 * @param orgs - Array of OrgAuthorization objects
 * @returns Array of sanitized org authorization objects with only allowed fields
 */
export function sanitizeOrgs(orgs: OrgAuthorization[]): SanitizedOrgAuthorization[] {
    return orgs.map((org) => ({
      aliases: org.aliases,
      configs: org.configs,
      username: org.username,
      instanceUrl: org.instanceUrl,
      isScratchOrg: org.isScratchOrg,
      isDevHub: org.isDevHub,
      isSandbox: org.isSandbox,
      orgId: org.orgId,
      oauthMethod: org.oauthMethod,
      isExpired: org.isExpired,
    }));
  }

  
export async function getAllAllowedOrgs(): Promise<(SanitizedOrgAuthorization & { orgType?: string })[]> {    
    const allOrgs = await AuthInfo.listAllAuthorizations();
  
    const sanitizedOrgs = sanitizeOrgs(allOrgs);

    return sanitizedOrgs;
  }

export async function getConnection(username: string): Promise<Connection> {
    const allOrgs = await getAllAllowedOrgs();
    const foundOrg = findOrgByUsernameOrAlias(allOrgs, username);
  
    if (!foundOrg)
      return Promise.reject(
        new Error(
          'No org found with the provided username/alias. Ask the user to specify one or check their MCP Server startup config.'
        )
      );
  
    const authInfo = await AuthInfo.create({ username: foundOrg.username });
    const connection = await Connection.create({ authInfo });
    return connection;
  }

  export function findOrgByUsernameOrAlias(
    allOrgs: SanitizedOrgAuthorization[],
    usernameOrAlias: string
  ): SanitizedOrgAuthorization | undefined {
    return allOrgs.find((org) => {
      const isMatchingUsername = org.username === usernameOrAlias;
      const isMatchingAlias = org.aliases && Array.isArray(org.aliases) && org.aliases.includes(usernameOrAlias);
  
      return isMatchingUsername || isMatchingAlias;
    });
  }

  /**
   * Get only the DevOps Center org for commit operations
   */
  export async function getDoceHubOrg(): Promise<{
    doceHub: (SanitizedOrgAuthorization & { orgType?: string }) | null;
    error?: string;
  }> {
    const allOrgs = await getAllAllowedOrgs();
    
    const doceHub = allOrgs.find(org => org.orgType === 'DevOps Center') || null;

    let error = '';
    if (!doceHub) {
      error += 'DevOps Center org not found. ';
    }

    return {
      doceHub,
      error: error || undefined
    };
  }

  /**
   * Get both DevOps Center and Sandbox orgs with validation
   */
  export async function getRequiredOrgs(devopsUsername: string, sandboxUsername: string ): Promise<{
    doceHub: (SanitizedOrgAuthorization & { orgType?: string }) | null;
    sandbox: (SanitizedOrgAuthorization & { orgType?: string }) | null;
    error?: string;
  }> {
    const allOrgs = await getAllAllowedOrgs();

    const doceHub = allOrgs.find(org => org.username === devopsUsername) || null;
    const sandbox = allOrgs.find(org => org.username === sandboxUsername) || null;

    let error = '';
    if (!doceHub) {
      error += `DevOps Center org '${devopsUsername}' not found. Login with sf auth:web:login or set Devops_org_username. `;
    }
    if (!sandbox) {
      error += `Sandbox org '${sandboxUsername}' not found. Login with sf auth:web:login or set Sandbox_org_username. `;
    }
    if (doceHub && sandbox && doceHub.username === sandbox.username) {
      error += 'DevOps Center and Sandbox cannot be the same org. ';
    }

    return { doceHub, sandbox, error: error || undefined };
  }
