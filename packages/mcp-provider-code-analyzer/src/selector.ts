import {
    ENGINE_NAMES,
    SEVERITY_NAMES,
    SEVERITY_NUMBERS,
    GENERAL_TAGS,
    CATEGORIES,
    LANGUAGES,
    ENGINE_SPECIFIC_TAGS,
    SEVERITY_NAME_TO_NUMBER
} from "./constants.js";
import { emptyFilters, QueryFilters } from "./entities/query.js";

// Precompute allowed selector tokens (lowercased) once at module scope
const ALLOWED_SELECTOR_TOKENS_LOWER: ReadonlySet<string> = new Set<string>([
    ...ENGINE_NAMES.map(s => s.toLowerCase()),
    ...SEVERITY_NAMES.map(s => s.toLowerCase()),
    ...SEVERITY_NUMBERS.map(n => String(n)),
    ...GENERAL_TAGS.map(s => s.toLowerCase()),
    ...CATEGORIES.map(s => s.toLowerCase()),
    ...LANGUAGES.map(s => s.toLowerCase()),
    ...ENGINE_SPECIFIC_TAGS.map(s => s.toLowerCase())
]);

/**
 * Validates a selector string for query purposes.
 * - Supports engines, severities (names/numbers), and tags (categories/languages/general).
 * - Also allows custom tokens (rule=, file=, fileEndsWith=) which are considered valid bypass tokens.
 * Returns either {valid:true} or {valid:false, invalidTokens:[...]} with unique invalid entries.
 */
export function validateSelectorForQuery(selector: string): { valid: true } | { valid: false, invalidTokens: string[] } {
    const invalidTokens: string[] = [];
    const selectorGroups: string[] = selector.split(':').map(str => str.trim()).filter(str => str.length > 0);
    for (const rawGroup of selectorGroups) {
        if (rawGroup.startsWith('(') && rawGroup.endsWith(')')) {
            const groupBody = rawGroup.slice(1, -1);
            const groupTokens = groupBody.split(',').map(str => str.trim()).filter(str => str.length > 0);
            if (groupTokens.length === 0) {
                invalidTokens.push(rawGroup);
                continue;
            }
            for (const groupToken of groupTokens) {
                const normalizedGroupToken = groupToken.toLowerCase();
                if (normalizedGroupToken.startsWith('file=')
                    || normalizedGroupToken.startsWith('fileendswith=')
                    || normalizedGroupToken.startsWith('rule=')) {
                    continue;
                }
                if (!ALLOWED_SELECTOR_TOKENS_LOWER.has(normalizedGroupToken)) {
                    invalidTokens.push(groupToken);
                }
            }
            continue;
        }
        const normalizedToken = rawGroup.toLowerCase();
        if (normalizedToken.startsWith('file=') || normalizedToken.startsWith('fileendswith=') || normalizedToken.startsWith('rule=')) {
            continue;
        }
        if (!ALLOWED_SELECTOR_TOKENS_LOWER.has(normalizedToken)) {
            invalidTokens.push(rawGroup);
        }
    }
    return invalidTokens.length === 0 ? { valid: true } : { valid: false, invalidTokens: Array.from(new Set(invalidTokens)) };
}

/**
 * Parses a selector string into first-class query filters.
 * - AND semantics across ':'-separated groups.
 * - OR semantics within parenthesized groups, e.g. "(Security,Performance)".
 * - Supports custom tokens: rule=, file=, fileEndsWith=.
 */
export function parseSelectorToFilters(selector: string): QueryFilters {
    const filters: QueryFilters = emptyFilters();
    const selectorGroups: string[] = selector.split(':').map(str => str.trim()).filter(str => str.length > 0);

    for (const group of selectorGroups) {
        const groupTokens: string[] = group.startsWith('(') && group.endsWith(')')
            ? group.slice(1, -1).split(',').map(str => str.trim()).filter(str => str.length > 0)
            : [group];
        for (const rawToken of groupTokens) {
            const normalizedToken = rawToken.toLowerCase();
            if (ENGINE_NAMES.map(name => name.toLowerCase()).includes(normalizedToken)) {
                pushUnique(filters.engines, normalizedToken);
                continue;
            }
            if (SEVERITY_NAMES.map(name => name.toLowerCase()).includes(normalizedToken)) {
                const severityNumber = SEVERITY_NAME_TO_NUMBER[SEVERITY_NAMES.find(n => n.toLowerCase() === normalizedToken)!];
                pushUnique(filters.severities, severityNumber);
                continue;
            }
            if (['1', '2', '3', '4', '5'].includes(normalizedToken)) {
                pushUnique(filters.severities, Number(normalizedToken));
                continue;
            }
            if (normalizedToken.startsWith('rule=')) {
                const ruleValue = rawToken.slice(rawToken.indexOf('=') + 1).trim().toLowerCase();
                if (ruleValue.length > 0) {
                    pushUnique(filters.rules, ruleValue);
                }
                continue;
            }
            if (normalizedToken.startsWith('file=')) {
                const fileContainsValue = rawToken.slice(rawToken.indexOf('=') + 1).trim().toLowerCase();
                if (fileContainsValue.length > 0) {
                    pushUnique(filters.fileContains, fileContainsValue);
                }
                continue;
            }
            if (normalizedToken.startsWith('fileendswith=')) {
                const fileEndsWithValue = rawToken.slice(rawToken.indexOf('=') + 1).trim().toLowerCase();
                if (fileEndsWithValue.length > 0) {
                    pushUnique(filters.fileEndsWith, fileEndsWithValue);
                }
                continue;
            }
            // Treat remaining as tag/category/language, case-insensitive
            pushUnique(filters.tags, rawToken.toLowerCase());
        }
    }
    return filters;
}

function pushUnique<T>(arr: T[], v: T): void {
    if (!arr.includes(v)) {
        arr.push(v);
    }
}


