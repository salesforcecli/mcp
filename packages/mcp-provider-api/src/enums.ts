/**
 * The release state for a tool, resource, or prompt.
 */
export enum ReleaseState {
  // General Availability (GA)
  GA = "ga",

  // Non-GA. (Please use this for now, but note it is subject to change) In the future, we may instead introduce BETA, DEV_PREVIEW, etc.
  NON_GA = "non-ga"
}

// Toolset that a tool should live under
export enum Toolset {
  CORE = 'core',
  DATA = 'data',
  ORGS = 'orgs',
  METADATA = 'metadata',
  TESTING = 'testing',
  USERS = 'users',
  MOBILE = 'mobile',
  MOBILE_CORE = 'mobile-core',
  AURA_EXPERTS = 'aura-experts',
  LWC_EXPERTS = 'lwc-experts',
  OTHER = 'other'
}

// Array of all Toolset names
export const TOOLSETS: Toolset[] = Object.values(Toolset);