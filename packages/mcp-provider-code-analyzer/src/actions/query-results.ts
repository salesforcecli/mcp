import fs from "node:fs";
import path from "node:path";
import { SEVERITY_NUMBER_TO_NAME } from "../constants.js";
import { QueryFilters } from "../entities/query.js";

type JsonViolationOutput = {
    rule: string;
    engine: string;
    severity: number;
    tags: string[];
    primaryLocationIndex: number;
    locations: Array<{
        file?: string;
        startLine?: number;
        startColumn?: number;
        endLine?: number;
        endColumn?: number;
        comment?: string;
    }>;
    message: string;
    resources: string[];
};

type JsonResultsOutput = {
    runDir: string;
    violationCounts: {
        total: number;
        sev1: number;
        sev2: number;
        sev3: number;
        sev4: number;
        sev5: number;
    };
    versions: Record<string, string>;
    violations: JsonViolationOutput[];
};

export type QueryResultsInput = {
    resultsFile: string;
    filters: QueryFilters;
    topN?: number;
    sortBy?: 'severity'|'rule'|'engine'|'file'|'none';
    sortDirection?: 'asc'|'desc';
};

export type QueryResultsOutput = {
    status: string;
    resultsFile?: string;
    totalViolations?: number;
    totalMatches?: number;
    violations?: Array<{
        rule: string;
        engine: string;
        severity: number;
        severityName: string;
        tags: string[];
        message: string;
        primaryLocation: {
            file?: string;
            startLine?: number;
            startColumn?: number;
        };
        resources?: string[];
    }>;
};

export interface QueryResultsAction {
    exec(input: QueryResultsInput): Promise<QueryResultsOutput>;
}

export class QueryResultsActionImpl implements QueryResultsAction {
    public async exec(input: QueryResultsInput): Promise<QueryResultsOutput> {
        const absResultsFile = path.resolve(input.resultsFile);
        const data: JsonResultsOutput = JSON.parse(fs.readFileSync(absResultsFile, 'utf8'));
        const allViolations: JsonViolationOutput[] = Array.isArray(data?.violations) ? data.violations : [];

        const filters = input.filters;
        let filtered: JsonViolationOutput[] = allViolations.filter(v => matchesFilters(v, filters));

        const sortBy = input.sortBy ?? 'severity';
        const sortDirection = input.sortDirection ?? 'asc';
        filtered = sortViolations(filtered, sortBy, sortDirection);
        const topN = input.topN ?? 5;
        const limited = filtered.slice(0, topN);

        const mapped = limited.map(v => {
            const primary = v.locations?.[v.primaryLocationIndex] ?? {};
            return {
                rule: v.rule,
                engine: v.engine,
                severity: v.severity,
                severityName: SEVERITY_NUMBER_TO_NAME[v.severity as 1|2|3|4|5] ?? String(v.severity),
                tags: v.tags,
                message: v.message,
                primaryLocation: {
                    file: primary.file,
                    startLine: primary.startLine,
                    startColumn: primary.startColumn
                },
                resources: v.resources
            };
        });

        return {
            status: 'success',
            resultsFile: absResultsFile,
            totalViolations: data?.violationCounts?.total ?? allViolations.length,
            totalMatches: filtered.length,
            violations: mapped
        };
    }
}

function sortViolations(arr: JsonViolationOutput[], sortBy: 'severity'|'rule'|'engine'|'file'|'none', dir: 'asc'|'desc'): JsonViolationOutput[] {
    if (sortBy === 'none') {
        return arr.slice();
    }
    const mul = dir === 'desc' ? -1 : 1;
    return arr.slice().sort((a, b) => {
        const aFile = a.locations?.[a.primaryLocationIndex]?.file ?? '';
        const bFile = b.locations?.[b.primaryLocationIndex]?.file ?? '';
        let cmp = 0;
        switch (sortBy) {
            case 'severity':
                cmp = (a.severity - b.severity);
                break;
            case 'rule':
                cmp = a.rule.localeCompare(b.rule);
                break;
            case 'engine':
                cmp = a.engine.localeCompare(b.engine);
                break;
            case 'file':
                cmp = aFile.localeCompare(bFile);
                break;
        }
        if (cmp !== 0) return cmp * mul;
        const s2 = aFile.localeCompare(bFile);
        if (s2 !== 0) return s2 * mul;
        return a.rule.localeCompare(b.rule) * mul;
    });
}

function matchesFilters(v: JsonViolationOutput, filters: QueryFilters): boolean {
    const engine = v.engine.toLowerCase();
    const rule = v.rule.toLowerCase();
    const tagsLower = new Set(v.tags.map(t => t.toLowerCase()));
    const primary = v.locations?.[v.primaryLocationIndex];
    const fileLower = (primary?.file || '').toLowerCase();

    if (filters.engines.length > 0 && !filters.engines.includes(engine)) {
        return false;
    }
    if (filters.severities.length > 0 && !filters.severities.includes(v.severity)) {
        return false;
    }
    if (filters.tags.length > 0) {
        let tagMatch = false;
        for (const t of filters.tags) {
            if (tagsLower.has(t.toLowerCase())) {
                tagMatch = true;
                break;
            }
        }
        if (!tagMatch) return false;
    }
    if (filters.rules.length > 0 && !filters.rules.map(r => r.toLowerCase()).includes(rule)) {
        return false;
    }
    if (filters.fileContains.length > 0) {
        let any = false;
        for (const s of filters.fileContains) {
            if (fileLower.includes(s.toLowerCase())) {
                any = true;
                break;
            }
        }
        if (!any) return false;
    }
    if (filters.fileEndsWith.length > 0) {
        let any = false;
        for (const s of filters.fileEndsWith) {
            if (fileLower.endsWith(s.toLowerCase())) {
                any = true;
                break;
            }
        }
        if (!any) return false;
    }
    return true;
}


