/*
 * Copyright 2026, Salesforce, Inc.
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

/**
 * Utility functions for safe SOQL query construction
 */

/**
 * Escapes single quotes in a string for use in SOQL queries.
 */
export function escapeSoqlString(value: string): string {
    if (typeof value !== 'string') {
        throw new Error('SOQL escape requires string input');
    }
    // Escape single quotes by doubling them (SOQL standard)
    return value.replace(/'/g, "\\'");
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

    // Check for injection patterns (excluding the single quote check since we'll escape those)
    return injectionPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validates a Salesforce username format.
 * Must contain @ and follow email-like format without injection patterns.
 */
export function isValidUsername(username: string): boolean {
    if (typeof username !== 'string') {
        return false;
    }

    const trimmed = username.trim();

    // Must contain @
    if (!trimmed.includes('@')) {
        return false;
    }

    // Basic email format: something@something.something
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(trimmed)) {
        return false;
    }

    // Check for SQL injection patterns
    if (containsSqlInjectionPatterns(trimmed)) {
        return false;
    }

    return true;
}

/**
 * Validates and escapes a Salesforce username for SOQL queries.
 * Throws an error if the username format is invalid or contains injection attempts.
 */
export function validateAndEscapeUsername(username: string): string {
    const trimmed = username.trim();

    if (!isValidUsername(trimmed)) {
        throw new Error(`Invalid username format or potential SQL injection detected: ${username}`);
    }

    return escapeSoqlString(trimmed);
}
