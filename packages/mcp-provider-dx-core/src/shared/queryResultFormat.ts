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

/** Default max records returned to the MCP client for a single SOQL tool call. */
export const DEFAULT_MAX_SOQL_RECORDS = 100;

/** Soft character budget for the serialized query payload (keeps agent context usable). */
export const DEFAULT_MAX_SOQL_CHARS = 40_000;

export type SoqlQueryLike = {
  done?: boolean;
  totalSize?: number;
  nextRecordsUrl?: string;
  records?: unknown[];
  [key: string]: unknown;
};

export type FormatSoqlQueryResultOptions = {
  maxRecords?: number;
  maxChars?: number;
};

/**
 * Formats a jsforce-style QueryResult for MCP text responses.
 * Caps records/payload size and, when truncated or incomplete, tells agents
 * not to re-run the identical SOQL (forcedotcom/mcp#8).
 */
export function formatSoqlQueryResult(
  result: SoqlQueryLike,
  options: FormatSoqlQueryResultOptions = {},
): string {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_SOQL_RECORDS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_SOQL_CHARS;

  const originalRecords = Array.isArray(result.records) ? result.records : [];
  const totalSize = typeof result.totalSize === 'number' ? result.totalSize : originalRecords.length;
  const apiDone = result.done !== false;

  let records = originalRecords;
  let truncatedByRecordCap = false;
  if (records.length > maxRecords) {
    records = records.slice(0, maxRecords);
    truncatedByRecordCap = true;
  }

  const buildPayload = (recs: unknown[]): string =>
    JSON.stringify(
      {
        done: apiDone && !truncatedByRecordCap && recs.length === originalRecords.length,
        totalSize,
        nextRecordsUrl: result.nextRecordsUrl,
        returnedRecords: recs.length,
        truncated: truncatedByRecordCap || !apiDone || recs.length < originalRecords.length,
        records: recs,
      },
      null,
      2,
    );

  let payload = buildPayload(records);
  let truncatedByChars = false;
  while (payload.length > maxChars && records.length > 1) {
    truncatedByChars = true;
    truncatedByRecordCap = true;
    records = records.slice(0, Math.max(1, Math.floor(records.length / 2)));
    payload = buildPayload(records);
  }

  // Last resort: single oversized record — keep metadata, drop field bodies.
  if (payload.length > maxChars && records.length === 1) {
    truncatedByChars = true;
    payload = buildPayload([
      {
        attributes: (records[0] as { attributes?: unknown })?.attributes,
        _truncated: 'Record omitted; select fewer fields or add LIMIT.',
      },
    ]);
  }

  const truncated = truncatedByRecordCap || truncatedByChars || !apiDone;
  if (!truncated) {
    // Preserve legacy shape expected by e2e parsers for small complete results.
    return `SOQL query results:\n\n${JSON.stringify(result, null, 2)}`;
  }

  const instructions = [
    'SOQL query results (TRUNCATED — do NOT re-run the same query):',
    '',
    'AGENT INSTRUCTIONS:',
    '- Do not call run_soql_query again with the identical SOQL.',
    `- totalSize=${totalSize}, returnedRecords=${records.length}, apiDone=${apiDone}.`,
    '- Narrow with WHERE filters and/or LIMIT/OFFSET, or select fewer fields.',
    '- Summarize what you have; ask the user before fetching more pages.',
    '',
    payload,
  ].join('\n');

  return instructions;
}
