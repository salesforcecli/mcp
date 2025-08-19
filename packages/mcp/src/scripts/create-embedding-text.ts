/*
 * Copyright 2025, Salesforce, Inc.
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
 * Action words - verbs that describe what a command does
 * These should get the highest weight (3x) in embedding text
 */
export const SF_ACTION_WORDS: readonly string[] = [
  // Core CRUD operations
  'create',
  'generate',
  'delete',
  'update',
  'upsert',
  'get',
  'set',
  'unset',

  // Deployment & sync operations
  'deploy',
  'retrieve',
  'push',
  'pull',
  'sync',
  'convert',
  'validate',
  'preview',

  // Execution operations
  'run',
  'execute',
  'test',
  'start',
  'stop',
  'resume',
  'cancel',
  'quick',

  // Information operations
  'list',
  'display',
  'show',
  'describe',
  'query',
  'search',
  'audit',
  'check',

  // Management operations
  'assign',
  'open',
  'login',
  'logout',
  'install',
  'uninstall',
  'enable',
  'disable',
  'publish',
  'report',

  // Data operations
  'import',
  'export',
  'bulk',
  'tree',
  'results',

  // Package operations
  'promote',
  'demote',
  'version',
];

/**
 * Domain words - nouns that represent Salesforce concepts and objects
 * These should get medium weight (2x) in embedding text
 */
export const SF_DOMAIN_WORDS: readonly string[] = [
  // Core Salesforce concepts
  'org',
  'metadata',
  'project',
  'package',
  'source',
  'data',
  'user',
  'permission',
  'permset',
  'permsetlicense',

  // Development concepts
  'apex',
  'flow',
  'trigger',
  'class',
  'component',
  'lwc',
  'aura',
  'lightning',
  'visualforce',
  'app',
  'tab',
  'field',
  'object',
  'record',
  'sobject',

  // Org types
  'scratch',
  'sandbox',
  'production',
  'devhub',
  'shape',
  'snapshot',

  // Metadata types
  'layout',
  'workflow',
  'validation',
  'rule',
  'profile',
  'role',
  'queue',
  'group',
  'territory',
  'sharing',

  // Testing & analysis
  'test',
  'coverage',
  'log',
  'debug',
  'trace',
  'analyzer',
  'doctor',

  // AI & Agents
  'agent',
  'bot',
  'template',
  'spec',
  'topic',
  'action',
  'evaluation',

  // Data management
  'bulk',
  'tree',
  'query',
  'soql',
  'sosl',
  'csv',
  'json',
  'xml',

  // Package management
  'managed',
  'unlocked',
  'unmanaged',
  'installed',
  'subscriber',

  // Community & Experience
  'community',
  'experience',
  'site',
  'portal',

  // Custom metadata
  'cmdt',
  'custom',
  'standard',

  // Development tools
  'plugin',
  'command',
  'flag',
  'config',
  'alias',
  'autocomplete',
  'help',
  'interactive',

  // API & Integration
  'api',
  'rest',
  'graphql',
  'soap',
  'request',
  'response',
  'endpoint',

  // Analytics
  'analytics',
  'dashboard',
  'report',
  'dataset',

  // DevOps & Pipeline
  'pipeline',
  'devops',
  'branch',
  'git',
  'repository',
  'manifest',

  // File types
  'file',
  'directory',
  'path',
  'zip',
  'archive',
];

/**
 * Modifier words - adjectives and adverbs that modify actions
 * These should get light weight (1.5x) in embedding text
 */
export const SF_MODIFIER_WORDS: readonly string[] = [
  // Action modifiers
  'quick',
  'async',
  'sync',
  'force',
  'dry',
  'preview',
  'validate',
  'check',
  'watch',
  'tail',
  'poll',

  // Scope modifiers
  'all',
  'local',
  'remote',
  'global',
  'default',
  'target',
  'source',
  'current',
  'recent',
  'latest',
  'specific',

  // State modifiers
  'active',
  'inactive',
  'enabled',
  'disabled',
  'tracked',
  'untracked',
  'deployed',
  'pending',
  'failed',
  'successful',

  // Type modifiers
  'managed',
  'unmanaged',
  'unlocked',
  'locked',
  'protected',
  'public',
  'private',
  'shared',

  // Format modifiers
  'formatted',
  'raw',
  'pretty',
  'compact',
  'verbose',
  'concise',
  'detailed',
  'summary',
];

/**
 * Context words - structural terms that provide context
 * These should get normal weight (1x) in embedding text
 */
export const SF_CONTEXT_WORDS: readonly string[] = [
  // Structural
  'force',
  'sf',
  'sfdx',
  'cli',
  'salesforce',

  // Directories
  'app',
  'main',
  'default',
  'classes',
  'objects',
  'layouts',
  'tabs',
  'flows',
  'triggers',
  'components',
  'static',
  'resources',

  // File extensions (without dots)
  'cls',
  'trigger',
  'page',
  'component',
  'app',
  'evt',
  'intf',
  'cmp',
  'design',
  'svg',
  'css',
  'js',
  'xml',
  'meta',

  // Common patterns
  'scratch',
  'def',
  'definition',
  'configuration',
  'settings',
  'preferences',
  'options',
  'parameters',
  'arguments',
  'flags',
  'values',
];

/**
 * Synonym mappings for expanding keywords with related terms
 * This helps match user queries that use different but related terminology
 */
const SYNONYM_MAP: Record<string, string[]> = {
  // Action synonyms
  deploy: ['deployment', 'deploying', 'push', 'upload', 'send'],
  retrieve: ['pull', 'download', 'fetch', 'get', 'sync'],
  list: ['show', 'display', 'enumerate', 'ls', 'view'],
  create: ['make', 'generate', 'new', 'add', 'build'],
  delete: ['remove', 'destroy', 'rm', 'drop', 'erase'],
  update: ['modify', 'change', 'edit', 'alter', 'refresh'],
  run: ['execute', 'start', 'launch', 'invoke'],
  query: ['search', 'find', 'select', 'lookup'],
  open: ['launch', 'start', 'view', 'access'],
  login: ['authenticate', 'auth', 'signin', 'connect'],
  logout: ['disconnect', 'signout', 'unauthenticate'],
  install: ['add', 'setup', 'configure'],
  uninstall: ['remove', 'delete', 'unsetup'],
  convert: ['transform', 'migrate', 'change', 'translate'],
  validate: ['verify', 'check', 'confirm', 'test'],
  preview: ['view', 'show', 'display', 'check'],
  report: ['status', 'info', 'summary', 'details'],
  resume: ['continue', 'restart', 'proceed'],
  cancel: ['stop', 'abort', 'terminate', 'halt'],

  // Domain synonyms
  org: ['organization', 'environment', 'instance', 'tenant'],
  metadata: ['meta', 'components', 'definitions', 'config'],
  scratch: ['dev', 'development', 'temp', 'temporary', 'trial'],
  sandbox: ['test', 'staging', 'non-prod', 'development'],
  production: ['prod', 'live', 'main', 'release'],
  apex: ['code', 'classes', 'triggers', 'programming'],
  flow: ['workflow', 'process', 'automation'],
  component: ['comp', 'lwc', 'aura', 'element'],
  lightning: ['lwc', 'aura', 'web-component'],
  object: ['sobject', 'entity', 'table', 'record-type'],
  field: ['column', 'attribute', 'property'],
  record: ['row', 'data', 'entry', 'item'],
  user: ['person', 'account', 'profile', 'identity'],
  permission: ['access', 'rights', 'privileges', 'security'],
  permset: ['permission-set', 'permissions', 'access-set'],
  package: ['app', 'bundle', 'module', 'extension'],
  source: ['code', 'files', 'project-files'],
  data: ['records', 'information', 'content'],
  test: ['testing', 'tests', 'verification', 'validation'],
  log: ['logs', 'debug', 'trace', 'output'],
  agent: ['bot', 'assistant', 'ai', 'chatbot'],
  template: ['spec', 'blueprint', 'pattern', 'example'],
  manifest: ['package-xml', 'config', 'definition'],
  bulk: ['batch', 'mass', 'multiple', 'many'],
  api: ['service', 'endpoint', 'interface', 'web-service'],
  devhub: ['dev-hub', 'development-hub', 'hub'],

  // Format synonyms
  json: ['javascript-object-notation', 'data'],
  xml: ['markup', 'config', 'meta'],
  csv: ['comma-separated', 'spreadsheet', 'data'],

  // Common user terms
  setup: ['configure', 'install', 'create', 'initialize'],
  config: ['configuration', 'settings', 'preferences'],
  info: ['information', 'details', 'data', 'summary'],
  help: ['assistance', 'documentation', 'guide', 'support'],
};

/**
 * Expand a list of keywords with their synonyms
 */
function expandWithSynonyms(keywords: string[]): string[] {
  const expanded = new Set(keywords);

  keywords.forEach((keyword) => {
    const synonyms = SYNONYM_MAP[keyword];
    if (synonyms) {
      synonyms.forEach((synonym) => expanded.add(synonym));
    }
  });

  return Array.from(expanded);
}

/**
 * Extract keywords from a command string and categorize them
 */
function extractKeywords(command: string): {
  actions: string[];
  domains: string[];
  modifiers: string[];
  context: string[];
} {
  const words = command
    .toLowerCase()
    .split(/[\s:-]+/)
    .filter((word) => word.length > 0);

  return {
    actions: words.filter((word) => SF_ACTION_WORDS.includes(word)),
    domains: words.filter((word) => SF_DOMAIN_WORDS.includes(word)),
    modifiers: words.filter((word) => SF_MODIFIER_WORDS.includes(word)),
    context: words.filter((word) => SF_CONTEXT_WORDS.includes(word)),
  };
}

/**
 * Create weighted embedding text for a command
 */
export function createWeightedEmbeddingText({
  command,
  summary,
  description,
  examples,
}: {
  command: string;
  summary: string;
  description: string;
  examples: string[];
}): string {
  const keywords = extractKeywords(command);

  // Expand keywords with synonyms for better matching
  const expandedActions = expandWithSynonyms(keywords.actions);
  const expandedDomains = expandWithSynonyms(keywords.domains);
  const expandedModifiers = expandWithSynonyms(keywords.modifiers);

  // Build weighted sections with cleaner formatting
  const weightedSections = [];

  // Primary actions (3x weight) - space-separated repetitions
  if (keywords.actions.length > 0) {
    const actionWords = keywords.actions.join(' ');
    weightedSections.push(`${actionWords} ${actionWords} ${actionWords}`);

    // Add synonyms (2x weight)
    const synonyms = expandedActions.filter((word) => !keywords.actions.includes(word));
    if (synonyms.length > 0) {
      const synonymText = synonyms.join(' ');
      weightedSections.push(`${synonymText} ${synonymText}`);
    }
  }

  // Domain objects (2x weight) - space-separated repetitions
  if (keywords.domains.length > 0) {
    const domainWords = keywords.domains.join(' ');
    weightedSections.push(`${domainWords} ${domainWords}`);

    // Add synonyms (1x weight)
    const synonyms = expandedDomains.filter((word) => !keywords.domains.includes(word));
    if (synonyms.length > 0) {
      weightedSections.push(synonyms.join(' '));
    }
  }

  // Modifiers (1.5x weight - approximate with 1.5 repetitions)
  if (keywords.modifiers.length > 0) {
    const modifierWords = keywords.modifiers.join(' ');
    weightedSections.push(`${modifierWords} ${modifierWords}`);

    // Add modifier synonyms
    const synonyms = expandedModifiers.filter((word) => !keywords.modifiers.includes(word));
    if (synonyms.length > 0) {
      weightedSections.push(synonyms.join(' '));
    }
  }

  // Natural language expansion
  if (keywords.actions.length > 0 && keywords.domains.length > 0) {
    const primaryAction = keywords.actions[0];
    const primaryDomain = keywords.domains[0];

    // Core action-domain pairs
    weightedSections.push(`${primaryAction} ${primaryDomain}`);
    weightedSections.push(`how to ${primaryAction} ${primaryDomain}`);

    // Add top synonym variations for better natural language matching
    const actionSynonyms = SYNONYM_MAP[primaryAction];
    const domainSynonyms = SYNONYM_MAP[primaryDomain];

    if (actionSynonyms && actionSynonyms.length > 0) {
      weightedSections.push(`${actionSynonyms[0]} ${primaryDomain}`);
    }
    if (domainSynonyms && domainSynonyms.length > 0) {
      weightedSections.push(`${primaryAction} ${domainSynonyms[0]}`);
    }
  }

  // Include natural content for semantic understanding
  return `${weightedSections.join(
    ' '
  )}\n\nCommand: ${command}\nSummary: ${summary}\n\nDescription: ${description}\n\nExamples:\n${
    examples?.join('\n') ?? 'No examples available'
  }`;
}
