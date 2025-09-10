/**
 * Helper function to easily get an error message from a catch statement
 */
export function getErrorMessage(error: any): string {
    return error instanceof Error ? error.message : /* istanbul ignore next */ String(error);
}

/**
 * Helper function to validate that a string is not empty or whitespace
 */
export function isValidString(value: string | undefined | null): boolean {
    return value !== undefined && value !== null && value.trim().length > 0;
}

/**
 * Helper function to format org display name
 */
export function formatOrgDisplayName(username: string, instanceUrl?: string): string {
    if (instanceUrl) {
        return `${username} (${instanceUrl})`;
    }
    return username;
}

/**
 * Helper function to extract repository name from URL
 */
export function extractRepoName(repoUrl: string): string {
    return (repoUrl.split('/').pop() || '').replace(/\.git$/, '') || 'repo';
}
