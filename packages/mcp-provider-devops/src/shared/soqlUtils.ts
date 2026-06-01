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
 * Validates and escapes a work item name for SOQL.
 * Throws an error if the format is invalid.
 */
export function validateWorkItemName(name: string): string {
    const trimmed = name.trim();
    if (!isValidWorkItemName(trimmed)) {
        throw new Error(`Invalid work item name format: ${name}. Expected format: WI-XXXXXXX`);
    }
    return escapeSoqlString(trimmed);
}
