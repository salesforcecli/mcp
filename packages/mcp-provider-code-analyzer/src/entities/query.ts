export type QueryFilters = {
    /**
     * Engine names to include (lowercased).
     * Why: Allow users to scope queries to a specific engine, e.g., ESLint or PMD.
     * Example: engines = ["pmd"] → only PMD violations are considered.
     */
    engines: string[];
    /**
     * Severities to include (1..5; lower number = more severe).
     * Why: Support “top N most severe” and per-severity filtering.
     * Example: severities = [1,2] → only Critical and High violations.
     */
    severities: number[];
    /**
     * Tags (case-insensitive categories/languages/general tags), lowercased.
     * Why: Aligns with selector semantics for categories like Security/Performance
     * and languages like JavaScript/TypeScript.
     * Example: tags = ["security","performance"] → only those categories.
     */
    tags: string[];
    /**
     * Exact rule names, lowercased.
     * Why: Let users drill down to a specific rule across files/engines.
     * Example: rules = ["eslint.no-eval"] → only that rule’s violations.
     */
    rules: string[];
    /**
     * File path substring filters, lowercased.
     * Why: Quickly scope to a folder or partial path without exact matches.
     * Example: fileContains = ["src/app/"] → only files under src/app.
     */
    fileContains: string[];
    /**
     * File path suffix filters, lowercased.
     * Why: Target files by name or extension with a precise suffix match.
     * Example: fileEndsWith = ["foo.ts"] → files ending in “foo.ts”.
     */
    fileEndsWith: string[];
};

export function emptyFilters(): QueryFilters {
    return {
        engines: [],
        severities: [],
        tags: [],
        rules: [],
        fileContains: [],
        fileEndsWith: []
    };
}

