export type QueryFilters = {
    engines: string[];           // engine names (lowercased)
    severities: number[];        // 1-5
    tags: string[];              // lowercased tags/categories/languages
    rules: string[];             // lowercased exact rule names
    fileContains: string[];      // lowercased substrings
    fileEndsWith: string[];      // lowercased suffixes
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

