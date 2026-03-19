export const TelemetryEventName = "code-analyzer"
export const TelemetrySource = "MCP"

export const McpTelemetryEvents = {
    ENGINE_SELECTION: 'engine_selection',
    ENGINE_EXECUTION: 'engine_execution',
    RESULTS_QUERY: 'results_query',
    CUSTOM_RULE_CREATED: 'custom_rule_created'
}

export const ENGINE_NAMES = [
    'eslint',
    'regex',
    'retire-js',
    'flow',
    'pmd',
    'cpd',
    'sfge'
] as const;

export type EngineName = typeof ENGINE_NAMES[number];

export const ENGINE_NAME_SET: ReadonlySet<EngineName> = new Set(ENGINE_NAMES);

// Severities
export const SEVERITY_NAMES = [
    'Critical',
    'High',
    'Moderate',
    'Low',
    'Info'
] as const;

export type SeverityName = typeof SEVERITY_NAMES[number];

export const SEVERITY_NUMBERS = [1, 2, 3, 4, 5] as const;

export type SeverityNumber = typeof SEVERITY_NUMBERS[number];

export const SEVERITY_NAME_TO_NUMBER: Readonly<Record<SeverityName, SeverityNumber>> = {
    Critical: 1,
    High: 2,
    Moderate: 3,
    Low: 4,
    Info: 5
} as const;

export const SEVERITY_NUMBER_TO_NAME: Readonly<Record<SeverityNumber, SeverityName>> = {
    1: 'Critical',
    2: 'High',
    3: 'Moderate',
    4: 'Low',
    5: 'Info'
} as const;

// Tags (case-insensitive by convention; these are canonical-cased constants)
export const GENERAL_TAGS = [
    'Recommended',
    'Custom',
    'All'
] as const;

export type GeneralTag = typeof GENERAL_TAGS[number];

export const GENERAL_TAG_SET: ReadonlySet<GeneralTag> = new Set(GENERAL_TAGS);

export const CATEGORIES = [
    'BestPractices',
    'CodeStyle',
    'Design',
    'Documentation',
    'ErrorProne',
    'Security',
    'Performance'
] as const;

export type Category = typeof CATEGORIES[number];

export const CATEGORY_SET: ReadonlySet<Category> = new Set(CATEGORIES);

export const LANGUAGES = [
    'Apex',
    'CSS',
    'HTML',
    'JavaScript',
    'TypeScript',
    'Visualforce',
    'XML'
] as const;

export type Language = typeof LANGUAGES[number];

export const LANGUAGE_SET: ReadonlySet<Language> = new Set(LANGUAGES);

export const LANGUAGE_NAMES = {
    Apex: 'apex',
    CSS: 'css',
    HTML: 'html',
    JavaScript: 'javascript',
    TypeScript: 'typescript',
    Visualforce: 'visualforce',
    XML: 'xml'
} as const;

export const ENGINE_SPECIFIC_TAGS = [
    'DevPreview',
    'LWC'
] as const;

export type EngineSpecificTag = typeof ENGINE_SPECIFIC_TAGS[number];

export const ENGINE_SPECIFIC_TAG_SET: ReadonlySet<EngineSpecificTag> = new Set(ENGINE_SPECIFIC_TAGS);