import { AuthInfo, OrgAuthorization, Connection } from "@salesforce/core";
import { SanitizedOrgAuthorization } from "./types.js";

/**
 * Sanitizes org authorization data by removing sensitive fields.
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

/**
 * Retrieves all authenticated Salesforce orgs with type identification.
 */
export async function getAllAllowedOrgs(): Promise<(SanitizedOrgAuthorization & { orgType?: string })[]> {
    const allOrgs = await AuthInfo.listAllAuthorizations();
    const sanitizedOrgs = sanitizeOrgs(allOrgs);

    const devopsUsername = process.env.Devops_org_username;
    const sandboxUsername = process.env.Sandbox_org_username;
    const mpUsername = process.env.MP_org_username;

    if (!devopsUsername && !sandboxUsername && !mpUsername) {
        console.warn('No org type environment variables set. Org type identification will be disabled.');
        console.warn('Set Devops_org_username, Sandbox_org_username, or MP_org_username to enable org type detection.');
    }
    const taggedOrgs = sanitizedOrgs.map(org => {
      if (devopsUsername && org.username === devopsUsername) {
        return { ...org, orgType: 'DevOps Center' };
      } else if (mpUsername && org.username === mpUsername) {
        return { ...org, orgType: 'Managed Package DevOps' };
      } else if (sandboxUsername && org.username === sandboxUsername) {
        return { ...org, orgType: 'Sandbox' };
      } else {
        return { ...org, orgType: 'Other' };
      }
    });

    if (taggedOrgs.length === 0) {
      console.error('No orgs found that match the allowed orgs configuration. User should be loggedin into required orgs usi sf cli.');
    }

    return taggedOrgs;
  }


/**
 * Creates a Salesforce connection for the specified username or alias.
 */
export async function getConnection(username: string): Promise<Connection> {
    const allOrgs = await getAllAllowedOrgs();
    const foundOrg = findOrgByUsernameOrAlias(allOrgs, username);
  
    if (!foundOrg) {
      return Promise.reject(
        new Error(
          'No org found with the provided username/alias. Ask the user to specify one or check their MCP Server startup config.'
        )
      );
    }
  
    const authInfo = await AuthInfo.create({ username: foundOrg.username });
    const connection = await Connection.create({ authInfo });
    return connection;
}

/**
 * Finds an org by username or alias from the list of available orgs.
 */
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
 * Retrieves the DevOps Center org for commit operations.
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
 * Retrieves both DevOps Center and Sandbox orgs with validation.
 */
  export async function getRequiredOrgs(devopsUsername: string, sandboxUsername: string ): Promise<{
    doceHub: (SanitizedOrgAuthorization & { orgType?: string }) | null;
    sandbox: (SanitizedOrgAuthorization & { orgType?: string }) | null;
    error?: string;
  }> {
    const allOrgs = await getAllAllowedOrgs();

    // Resolve from available orgs strictly by username
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