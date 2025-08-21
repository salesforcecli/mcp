// Toolset that a tool should live under
export enum Toolset {
    CORE = 'core',
    DATA = 'data',
    ORGS = 'orgs',
    METADATA = 'metadata',
    TESTING = 'testing',
    USERS = 'users',

    // TODO: Remove this in favor of adding a getState method to the McpTool class
    EXPERIMENTAL = 'experimental'
}

// Array of all Toolset names
export const TOOLSETS: Toolset[] = Object.values(Toolset);