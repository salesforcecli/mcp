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

import { AuthInfo, ConfigAggregator, ConfigInfo, OrgConfigProperties } from '@salesforce/core';

// import { AuthInfo, StateAggregator, Org, OrgAuthorization, SfdxProject } from '@salesforce/core';

// const infos = await AuthInfo.listAllAuthorizations();

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

// console.log(infos);
// AuthInfo.hasAuthentications

// // Connect to the user
// const authInfo = await AuthInfo.create({ username });
// const connection = await Connection.create({ authInfo });

export async function getOrgs(): Promise<FilteredOrgAuthorization[]> {
  const orgs = await AuthInfo.listAllAuthorizations();

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

  // Filter the orgs to only include the fields we want
  const filteredOrgs = orgs.map((org) => {
    const filteredOrg: FilteredOrgAuthorization = {};
    fieldsToReturn.forEach((field) => {
      const value = org[field as keyof typeof org];
      if (value !== null) {
        // Use type assertion to the correct type based on the field
        switch (field) {
          case 'aliases':
            if (Array.isArray(value)) filteredOrg.aliases = value;
            break;
          case 'username':
          case 'instanceUrl':
          case 'orgId':
          case 'oauthMethod':
            if (typeof value === 'string') filteredOrg[field] = value;
            break;
          case 'isScratchOrg':
          case 'isDevHub':
          case 'isSandbox':
          case 'isExpired':
            if (typeof value === 'boolean') filteredOrg[field] = value;
            break;
        }
      }
    });
    return filteredOrg;
  });

  return filteredOrgs;
}

// const orgs = await getOrgs();
// console.log(orgs);

export async function getDefaultTargetOrg(): Promise<ConfigInfo> {
  // Get the aggregated config values
  const aggregator = await ConfigAggregator.create();

  return aggregator.getInfo(OrgConfigProperties.TARGET_ORG);
}

// const defaultTargetOrg = await getDefaultTargetOrg();
// console.log('Default Target Org:', defaultTargetOrg);

export async function getDefaultTargetDevHub(): Promise<ConfigInfo> {
  // Get the aggregated config values
  const aggregator = await ConfigAggregator.create();

  return aggregator.getInfo(OrgConfigProperties.TARGET_DEV_HUB);
}
// const defaultTargetDevHub = await getDefaultTargetDevHub();
// console.log('Default Target Dev Hub:', defaultTargetDevHub);
