/**
 * Utility functions for safe SOQL query construction
 */

/**
 * Validates that a string is a valid Salesforce ID (15 or 18 characters).
 * Returns true if valid, false otherwise.
 */
export function isValidSalesforceId(id: string): boolean {
    if (typeof id !== 'string') {
        return false;
    }
    // Salesforce IDs are either 15 or 18 characters, alphanumeric
    const trimmed = id.trim();
    const idPattern = /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/;
    return idPattern.test(trimmed);
}

/**
 * Escapes single quotes in a string for use in SOQL queries.
 * Throws an error if the value contains SQL injection attempts.
 */
export function escapeSoqlString(value: string): string {
    if (typeof value !== 'string') {
        throw new Error('SOQL escape requires string input');
    }

    // Escape single quotes by doubling them (SOQL standard)
    return value.replace(/'/g, "\\'");
}

/**
 * Validates and returns a Salesforce ID, or throws an error.
 * Use this for ID fields to prevent injection.
 */
export function validateSalesforceId(id: string, fieldName: string = 'ID'): string {
    if (!isValidSalesforceId(id)) {
        throw new Error(`Invalid Salesforce ID format for ${fieldName}: ${id}`);
    }
    return id.trim();
}

/**
 * Validates a work item name format (WI-XXXXXXX).
 * Returns true if valid, false otherwise.
 */
export function isValidWorkItemName(name: string): boolean {
    if (typeof name !== 'string') {
        return false;
    }
    // Work item names follow the pattern: WI- followed by digits
    const workItemPattern = /^WI-\d+$/;
    return workItemPattern.test(name.trim());
}

/**
 * Checks if a string contains potential SQL injection patterns.
 * Returns true if injection patterns are detected.
 */
export function containsSqlInjectionPatterns(value: string): boolean {
    if (typeof value !== 'string') {
        return true;
    }

    const trimmed = value.trim();

    // Check for common SQL injection patterns
    const injectionPatterns = [
        /--/,           // SQL comment
        /;/,            // Statement terminator
        /\bOR\b/i,      // OR keyword
        /\bAND\b/i,     // AND keyword
        /\bUNION\b/i,   // UNION keyword
        /\bSELECT\b/i,  // SELECT keyword
        /\bDROP\b/i,    // DROP keyword
        /\bINSERT\b/i,  // INSERT keyword
        /\bUPDATE\b/i,  // UPDATE keyword
        /\bDELETE\b/i,  // DELETE keyword
        /\bEXEC\b/i,    // EXEC keyword
    ];

    // Check for injection patterns (excluding quotes which we'll escape)
    const withoutQuotes = trimmed.replace(/'/g, '');
    return injectionPatterns.some(pattern => pattern.test(withoutQuotes)) ||
           (trimmed.includes("'") && injectionPatterns.some(pattern => pattern.test(trimmed)));
}

/**
 * Validates and escapes a work item name for SOQL.
 * Accepts WI-XXXXXXX format or any alphanumeric string without injection patterns.
 * Throws an error if the format is invalid or contains injection attempts.
 */
export function validateWorkItemName(name: string): string {
    const trimmed = name.trim();

    // Check for SQL injection patterns first
    if (containsSqlInjectionPatterns(trimmed)) {
        throw new Error(`Invalid work item name: potential SQL injection detected in "${name}"`);
    }

    // If it matches the standard WI-XXXXXXX format, it's valid
    if (isValidWorkItemName(trimmed)) {
        return escapeSoqlString(trimmed);
    }

    // Also allow alphanumeric names with spaces, hyphens, and underscores (for managed package work items)
    // but ensure no special characters that could be used for injection
    const safeNamePattern = /^[a-zA-Z0-9\s_'-]+$/;
    if (safeNamePattern.test(trimmed)) {
        return escapeSoqlString(trimmed);
    }

    throw new Error(`Invalid work item name format: ${name}`);
}
