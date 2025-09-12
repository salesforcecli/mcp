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
    // Get all orgs on the user's machine
    const allOrgs = await AuthInfo.listAllAuthorizations();
  
    // Sanitize the orgs to remove sensitive data
    const sanitizedOrgs = sanitizeOrgs(allOrgs);


    //todo: these will be removed after implementation of orgtype identification from env vars
    // Get env usernames
    //epic.out.3911bd11f31e@orgfarm.salesforce.com
    //arun.tyagi@creative-otter-i0k30.com
    //gcanariotdxblr@salesforce.com
    const devopsUsername = process.env.Devops_org_username || 'epic.out.3911bd11f31e@orgfarm.salesforce.com';
    const sandboxUsername = process.env.Sandbox_org_username || 'appdevdg-sdb4s@salesforce.com.sbox1clean';
    const mpUsername = process.env.MP_org_username || 'gcanariotdxblr@salesforce.com';

    // Tag orgs (noop for now)
    const taggedOrgs = sanitizedOrgs;
    
    /*.map(org => {
      if (org.username === devopsUsername) {
        return { ...org, orgType: 'DevOps Center' };
      } else if (org.username == mpUsername) {
        return { ...org, orgType: 'Managed Package DevOps' };
      } else if (org.username === sandboxUsername) {
        return { ...org, orgType: 'Sandbox' };
      } else {
        return { ...org, orgType: '' };
      }
    });*/

    if (taggedOrgs.length === 0) {
      console.error('No orgs found that match the allowed orgs configuration. User should be loggedin into required orgs usi sf cli.');
    }

    return taggedOrgs;
  }



// This function is the main entry point for Tools to get an allowlisted Connection
export async function getConnection(username: string): Promise<Connection> {
    // We get all allowed orgs each call in case the directory has changed (default configs)
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
      // Check if the org's username or alias matches the provided usernameOrAlias
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
    
    // Find DevOps Center org
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