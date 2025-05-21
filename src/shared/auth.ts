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

import { AuthInfo, Connection, ConfigAggregator, ConfigInfo, OrgConfigProperties } from '@salesforce/core';
import { ALLOWED_ORGS } from '../index.js';

// Define interface for filtered org data
type FilteredOrgAuthorization = {
  aliases?: string[];
  username?: string;
  instanceUrl?: string;
  isScratchOrg?: boolean;
  isDevHub?: boolean;
  isSandbox?: boolean;
  orgId?: string;
  oauthMethod?: string;
  isExpired?: boolean;
};

// Define a type for valid field keys
type OrgAuthorizationField = keyof FilteredOrgAuthorization;

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
  } else if (defaultTargetOrg && defaultTargetOrg.value) {
    // TODO: fix as?
    const foundOrg = findOrgByUsernameOrAlias(allAllowedOrgs, defaultTargetOrg.value as string);
    suggestedUsername = foundOrg?.username;
    aliasForReference = foundOrg?.aliases?.[0];
    reasoning = `it is the default ${targetOrgLocation}target org`;
  } else if (defaultTargetDevHub && defaultTargetDevHub.value) {
    const foundOrg = findOrgByUsernameOrAlias(allAllowedOrgs, defaultTargetDevHub.value as string);
    suggestedUsername = foundOrg?.username;
    aliasForReference = foundOrg?.aliases?.[0];
    reasoning = `it is the default ${targetDevHubLocation}dev hub org`;
  } else {
    reasoning = 'Error: no org was inferred. Ask the user to specify one';
  }

  return {
    suggestedUsername,
    reasoning,
    aliasForReference,
  };
}

export async function getConnection(username: string): Promise<Connection> {
  const allOrgs = await getAllAllowedOrgs();
  const foundOrg = findOrgByUsernameOrAlias(allOrgs, username);

  if (!foundOrg) {
    console.error(`No org found with username/alias: ${username}`);
    return Promise.reject(new Error(`No org found with username/alias: ${username}`));
  }

  const authInfo = await AuthInfo.create({ username: foundOrg.username });
  const connection = await Connection.create({ authInfo });
  return connection;
}

export function findOrgByUsernameOrAlias(
  allOrgs: FilteredOrgAuthorization[],
  usernameOrAlias: string
): FilteredOrgAuthorization | undefined {
  return allOrgs.find((org) => {
    // Check if the org's username or alias matches the provided usernameOrAlias
    const isMatchingUsername = org.username === usernameOrAlias;
    const isMatchingAlias = org.aliases && org.aliases.includes(usernameOrAlias);

    return isMatchingUsername || isMatchingAlias;
  });
}

export async function getAllAllowedOrgs(): Promise<FilteredOrgAuthorization[]> {
  const orgs = await AuthInfo.listAllAuthorizations();

  // Allowlisted keys to be returned. This prevents accidental exposure of sensitive data (accessToken).
  const fieldsToReturn: OrgAuthorizationField[] = [
    'aliases',
    'username',
    'instanceUrl',
    'isScratchOrg',
    'isDevHub',
    'isSandbox',
    'orgId',
    'oauthMethod',
    'isExpired',
  ];

  // Get filtered orgs with all the fields we need
  const sanitizedOrgPromises = orgs.map((org) => {
    const sanitizedOrgs: FilteredOrgAuthorization = {};

    // Extract basic fields from the org
    fieldsToReturn.forEach((field) => {
      const value = org[field as keyof typeof org];
      if (value !== null) {
        // Use type assertion to the correct type based on the field
        switch (field) {
          case 'aliases':
            if (Array.isArray(value)) sanitizedOrgs.aliases = value;
            break;
          case 'username':
          case 'instanceUrl':
          case 'orgId':
          case 'oauthMethod':
            if (typeof value === 'string') sanitizedOrgs[field] = value;
            break;
          case 'isScratchOrg':
          case 'isDevHub':
          case 'isSandbox':
          case 'isExpired':
            if (typeof value === 'boolean') sanitizedOrgs[field] = value;
            break;
        }
      }
    });

    return sanitizedOrgs;
  });

  // Resolve all promises
  const filteredOrgs = await Promise.all(sanitizedOrgPromises);

  // Apply filtering based on allowed orgs
  const allowedOrgs = await filterAllowedOrgs(filteredOrgs);

  // TODO: this might not be the best place for this check
  if (allowedOrgs.length === 0) {
    console.error('No orgs found that match the allowed orgs configuration.');
  }

  return allowedOrgs;
}

// Function to filter orgs based on ALLOWED_ORGS configuration
export async function filterAllowedOrgs(orgs: FilteredOrgAuthorization[]): Promise<FilteredOrgAuthorization[]> {
  // Return all orgs if ALLOW_ALL_ORGS is set
  if (ALLOWED_ORGS.has('ALLOW_ALL_ORGS')) {
    return orgs;
  }

  // Get default orgs for filtering
  const defaultTargetOrg = await getDefaultTargetOrg();
  const defaultDevHub = await getDefaultTargetDevHub();

  return orgs.filter((org) => {
    // Skip orgs without a username
    if (!org.username) return false;

    // Check if org is specifically allowed by username
    if (ALLOWED_ORGS.has(org.username)) return true;

    // Check if org is allowed by alias
    if (org.aliases && org.aliases.some((alias) => ALLOWED_ORGS.has(alias))) return true;

    // Check if org matches the default target org and DEFAULT_TARGET_ORG is allowed
    if (ALLOWED_ORGS.has('DEFAULT_TARGET_ORG') && defaultTargetOrg) {
      const targetOrgValue = defaultTargetOrg.value as string | undefined;
      // Check if the default target org value matches username or any alias
      if (targetOrgValue && org.username === targetOrgValue) return true;
      if (targetOrgValue && org.aliases && org.aliases.includes(targetOrgValue)) return true;
    }

    // Check if org matches the default dev hub and DEFAULT_TARGET_DEV_HUB is allowed
    if (ALLOWED_ORGS.has('DEFAULT_TARGET_DEV_HUB') && defaultDevHub) {
      const devHubValue = defaultDevHub.value as string | undefined;
      // Check if the default dev hub value matches username or any alias
      if (devHubValue && org.username === devHubValue) return true;
      if (devHubValue && org.aliases && org.aliases.includes(devHubValue)) return true;
    }

    // Org not allowed
    return false;
  });
}

// Helper function to get default config for a property
async function getDefaultConfig(property: OrgConfigProperties): Promise<ConfigInfo | undefined> {
  // If the directory changes, the singleton instance of ConfigAggregator is not updated.
  // It continues to use the old local or global config.
  // @ts-expect-error Accessing private static instance to reset singleton between directory changes
  ConfigAggregator.instance = undefined;
  const aggregator = await ConfigAggregator.create();
  const config = aggregator.getInfo(property);
  return config.value ? config : undefined;
}

export async function getDefaultTargetOrg(): Promise<ConfigInfo | undefined> {
  return getDefaultConfig(OrgConfigProperties.TARGET_ORG);
}

export async function getDefaultTargetDevHub(): Promise<ConfigInfo | undefined> {
  return getDefaultConfig(OrgConfigProperties.TARGET_DEV_HUB);
}
