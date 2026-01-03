import { z } from 'zod';

/**
 * A collection of reusable Tool parameters for DevOps tools
 */

export const usernameOrAliasParam = z.string()
  .describe(`The username or alias for the Salesforce org to run this tool against.

A username follows the <name@domain.com> format.
If the user refers to an org with a string not following that format, it can be a valid alias.

IMPORTANT:
- If it is not clear what the username or alias is, run the #get_username tool to resolve it.
- NEVER guess or make-up a username or alias.
`);

export const directoryParam = z.string().describe(`The directory to run this tool from.
AGENT INSTRUCTIONS:
We need to know where the user wants to run this tool from.
Look at your current Workspace Context to determine this filepath.
ALWAYS USE A FULL PATH TO THE DIRECTORY.
Unless the user explicitly asks for a different directory, or a new directory is created from the action of a tool, use this same directory for future tool calls.
`);
