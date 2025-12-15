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

export function validateSelectorForQuery(selector: string): { valid: true } | { valid: false, invalidTokens: string[] } {
    const allowedLower = new Set<string>([
        ...ENGINE_NAMES.map(s => s.toLowerCase()),
        ...SEVERITY_NAMES.map(s => s.toLowerCase()),
        ...SEVERITY_NUMBERS.map(n => String(n)),
        ...GENERAL_TAGS.map(s => s.toLowerCase()),
        ...CATEGORIES.map(s => s.toLowerCase()),
        ...LANGUAGES.map(s => s.toLowerCase()),
        ...ENGINE_SPECIFIC_TAGS.map(s => s.toLowerCase())
    ]);
    const invalid: string[] = [];
    const parts = selector.split(':').map(s => s.trim()).filter(s => s.length > 0);
    for (let token of parts) {
        if (token.startsWith('(') && token.endsWith(')')) {
            const inner = token.slice(1, -1);
            const innerTokens = inner.split(',').map(s => s.trim()).filter(s => s.length > 0);
            if (innerTokens.length === 0) {
                invalid.push(token);
                continue;
            }
            for (let t of innerTokens) {
                const tl = t.toLowerCase();
                if (tl.startsWith('file=')
                    || tl.startsWith('fileendswith=')
                    || tl.startsWith('rule=')) {
                    continue;
                }
                if (!allowedLower.has(tl)) {
                    invalid.push(t);
                }
            }
            continue;
        }
        const tl = token.toLowerCase();
        if (tl.startsWith('file=') || tl.startsWith('fileendswith=') || tl.startsWith('rule=')) {
            continue;
        }
        if (!allowedLower.has(tl)) {
            invalid.push(token);
        }
    }
    return invalid.length === 0 ? { valid: true } : { valid: false, invalidTokens: Array.from(new Set(invalid)) };
}

export function parseSelectorToFilters(selector: string): QueryFilters {
    const filters = emptyFilters();
    const parts = selector.split(':').map(s => s.trim()).filter(s => s.length > 0);

    for (const part of parts) {
        const tokens = part.startsWith('(') && part.endsWith(')')
            ? part.slice(1, -1).split(',').map(s => s.trim()).filter(s => s.length > 0)
            : [part];
        for (let raw of tokens) {
            const t = raw.toLowerCase();
            if (ENGINE_NAMES.map(s => s.toLowerCase()).includes(t)) {
                pushUnique(filters.engines, t);
                continue;
            }
            if (SEVERITY_NAMES.map(s => s.toLowerCase()).includes(t)) {
                const mapped = SEVERITY_NAME_TO_NUMBER[SEVERITY_NAMES.find(n => n.toLowerCase() === t)!];
                pushUnique(filters.severities, mapped);
                continue;
            }
            if (['1', '2', '3', '4', '5'].includes(t)) {
                pushUnique(filters.severities, Number(t));
                continue;
            }
            if (t.startsWith('rule=')) {
                pushUnique(filters.rules, raw.slice(raw.indexOf('=') + 1).toLowerCase());
                continue;
            }
            if (t.startsWith('file=')) {
                pushUnique(filters.fileContains, raw.slice(raw.indexOf('=') + 1).toLowerCase());
                continue;
            }
            if (t.startsWith('fileendswith=')) {
                pushUnique(filters.fileEndsWith, raw.slice(raw.indexOf('=') + 1).toLowerCase());
                continue;
            }
            // Treat remaining as tag/category/language, case-insensitive
            pushUnique(filters.tags, raw.toLowerCase());
        }
    }
    return filters;
}

function pushUnique<T>(arr: T[], v: T): void {
    if (!arr.includes(v)) {
        arr.push(v);
    }
}


