/*
 * Copyright 2025, Salesforce, Inc.
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

/* eslint-disable no-console */

import { AuthInfo, Connection, ConfigAggregator, OrgConfigProperties, type OrgAuthorization } from '@salesforce/core';
import { type ConfigInfoWithCache, type SanitizedOrgAuthorization } from './types.js';
import { buildOrgAllowList, parseStartupArguments } from './utils.js';

const url = new URL(import.meta.url);
const params = url.searchParams.get('orgs');
const paramOrg = params ? params : undefined;

const { values } = parseStartupArguments();
const ORG_ALLOWLIST = buildOrgAllowList(paramOrg ?? values.orgs);
console.error(' - Allowed orgs:', ORG_ALLOWLIST);

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

export async function suggestUsername(): Promise<{
  suggestedUsername: string | undefined;
  reasoning: string;
  aliasForReference?: string;
}> {
  let reasoning: string;
  let suggestedUsername: string | undefined;
  let aliasForReference: string | undefined;

  const allAllowedOrgs = await getAllAllowedOrgs();
  const defaultTargetOrg = await getDefaultTargetOrg();
  const defaultTargetDevHub = await getDefaultTargetDevHub();

  const targetOrgLocation = defaultTargetOrg?.location ? `(${defaultTargetOrg.location}) ` : '';
  const targetDevHubLocation = defaultTargetDevHub?.location ? `(${defaultTargetDevHub.location}) ` : '';

  if (allAllowedOrgs.length === 1) {
    suggestedUsername = allAllowedOrgs[0].username;
    aliasForReference = allAllowedOrgs[0].aliases?.[0];
    reasoning = 'it was the only org found in the MCP Servers allowlisted orgs';
  } else if (defaultTargetOrg?.value) {
    const foundOrg = findOrgByUsernameOrAlias(allAllowedOrgs, defaultTargetOrg.value);
    suggestedUsername = foundOrg?.username;
    aliasForReference = foundOrg?.aliases?.[0];
    reasoning = `it is the default ${targetOrgLocation}target org`;
  } else if (defaultTargetDevHub?.value) {
    const foundOrg = findOrgByUsernameOrAlias(allAllowedOrgs, defaultTargetDevHub.value);
    suggestedUsername = foundOrg?.username;
    aliasForReference = foundOrg?.aliases?.[0];
    reasoning = `it is the default ${targetDevHubLocation}dev hub org`;
  } else {
    reasoning = 'Error: no org was inferred. Ask the user to specify one';
  }

  return {
    suggestedUsername,
    aliasForReference,
    reasoning,
  };
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

export async function getAllAllowedOrgs(): Promise<SanitizedOrgAuthorization[]> {
  // Get all orgs on the user's machine
  const allOrgs = await AuthInfo.listAllAuthorizations();

  // Sanitize the orgs to remove sensitive data
  const sanitizedOrgs = sanitizeOrgs(allOrgs);

  // Filter out orgs that are not in ORG_ALLOWLIST
  const allowedOrgs = await filterAllowedOrgs(sanitizedOrgs, ORG_ALLOWLIST);

  // If no orgs are found, stop the server
  if (allowedOrgs.length === 0) {
    console.error('No orgs found that match the allowed orgs configuration. Check MCP Server startup config.');
    process.exit(1);
  }

  return allowedOrgs;
}

// Function to filter orgs based on ORG_ALLOWLIST configuration
export async function filterAllowedOrgs(
  orgs: SanitizedOrgAuthorization[],
  ALLOWLIST = ORG_ALLOWLIST
): Promise<SanitizedOrgAuthorization[]> {
  // Return all orgs if ALLOW_ALL_ORGS is set
  if (ALLOWLIST.has('ALLOW_ALL_ORGS')) return orgs;

  // Get default orgs for filtering
  const defaultTargetOrg = await getDefaultTargetOrg();
  const defaultTargetDevHub = await getDefaultTargetDevHub();

  return orgs.filter((org) => {
    // Skip orgs without a username
    if (!org.username) return false;

    // Check if org is specifically allowed by username
    if (ALLOWLIST.has(org.username)) return true;

    // Check if org is allowed by alias
    if (org.aliases?.some((alias) => ALLOWLIST.has(alias))) return true;

    // If DEFAULT_TARGET_ORG is set, check for a username or alias match
    if (ALLOWLIST.has('DEFAULT_TARGET_ORG') && defaultTargetOrg?.value) {
      if (org.username === defaultTargetOrg.value) return true;
      if (org.aliases?.includes(defaultTargetOrg.value)) return true;
    }

    // If DEFAULT_TARGET_DEV_HUB is set, check for a username or alias match
    if (ALLOWLIST.has('DEFAULT_TARGET_DEV_HUB') && defaultTargetDevHub?.value) {
      if (org.username === defaultTargetDevHub.value) return true;
      if (org.aliases?.includes(defaultTargetDevHub.value)) return true;
    }

    // Org not allowed
    return false;
  });
}

const defaultOrgMaps = {
  [OrgConfigProperties.TARGET_ORG]: new Map<string, ConfigInfoWithCache>(),
  [OrgConfigProperties.TARGET_DEV_HUB]: new Map<string, ConfigInfoWithCache>(),
};

// Helper function to get default config for a property
// Values are cached based on ConfigInfo path after first retrieval
// This is to prevent manipulation of the config file after server start
async function getDefaultConfig(
  property: OrgConfigProperties.TARGET_ORG | OrgConfigProperties.TARGET_DEV_HUB
): Promise<ConfigInfoWithCache | undefined> {
  // If the directory changes, the singleton instance of ConfigAggregator is not updated.
  // It continues to use the old local or global config.
  // Note: We could update ConfigAggregator to have a clearInstance method like StateAggregator
  // @ts-expect-error Accessing private static instance to reset singleton between directory changes
  ConfigAggregator.instance = undefined;
  const aggregator = await ConfigAggregator.create();
  const config = aggregator.getInfo(property);

  const { value, path, key, location } = config;

  if (!value || typeof value !== 'string' || !path) return undefined;

  // Create a typed config object with the necessary properties
  // This reduces assertions and lowers context returned to the LLM
  const typedConfig: ConfigInfoWithCache = { key, location, value, path };

  if (defaultOrgMaps[property].has(path)) {
    // If the cache has the config's path set, use the cached config
    const cachedConfig = defaultOrgMaps[property].get(path)!;
    return { ...cachedConfig, cached: true };
  } else {
    defaultOrgMaps[property].set(path, typedConfig);
    return typedConfig;
  }
}

export async function getDefaultTargetOrg(): Promise<ConfigInfoWithCache | undefined> {
  return getDefaultConfig(OrgConfigProperties.TARGET_ORG);
}

export async function getDefaultTargetDevHub(): Promise<ConfigInfoWithCache | undefined> {
  return getDefaultConfig(OrgConfigProperties.TARGET_DEV_HUB);
}
