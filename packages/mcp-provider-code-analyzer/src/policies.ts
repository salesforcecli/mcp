import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const DEFAULT_TOPN_POLICY_LIMIT = 10;

export type PolicyErrorCode = 'POLICY_TOPN_LIMIT' | 'POLICY_FULL_LIST_REJECTED';

export function makePolicyError(message: string, code: PolicyErrorCode): CallToolResult {
  const structured = { status: message, code };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured
  };
}

export function enforceTopNLimit(
  topN: number | undefined,
  allowLargeResultSet: boolean | undefined,
  limit: number = DEFAULT_TOPN_POLICY_LIMIT
): { ok: true } | { ok: false; message: string; code: PolicyErrorCode } {
  const value = topN ?? 5;
  if (value > limit && !allowLargeResultSet) {
    return {
      ok: false,
      message: `Requested topN exceeds ${limit}. Provide topN <= ${limit} or set allowLargeResultSet=true.`,
      code: 'POLICY_TOPN_LIMIT'
    };
  }
  return { ok: true };
}

/**
 * Determines whether the selector resolves to the full unfiltered list of rules.
 * This occurs when the selector is exactly "All" (case-insensitive), optionally with whitespace
 * or wrapped in a single OR-group like "(All)". A selector like "(All,Security)" is NOT considered full list.
 */
export function isFullListSelector(selector: string): boolean {
  if (!selector) return false;
  const trimmed = selector.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "all") return true;
  if (lower.startsWith("(") && lower.endsWith(")")) {
    const inner = lower.slice(1, -1).trim();
    const innerTokens = inner.split(",").map(t => t.trim()).filter(Boolean);
    return innerTokens.length === 1 && innerTokens[0] === "all";
  }
  return false;
}

export const DEFAULT_LIST_POLICY_LIMIT = 10;

export function capArrayIfFullList<T>(
  selector: string,
  allowFullList: boolean | undefined,
  items: T[],
  limit: number = DEFAULT_LIST_POLICY_LIMIT
): { items: T[]; truncated: boolean } {
  if (isFullListSelector(selector) && !allowFullList) {
    return { items: items.slice(0, limit), truncated: items.length > limit };
  }
  return { items, truncated: false };
}

export function computeEffectiveTopN(
  topN: number | undefined,
  allowLargeResultSet: boolean | undefined,
  limit: number = DEFAULT_TOPN_POLICY_LIMIT
): { effectiveTopN: number; truncated: boolean } {
  const requested = topN ?? 5;
  if (requested > limit && !allowLargeResultSet) {
    return { effectiveTopN: limit, truncated: true };
  }
  return { effectiveTopN: requested, truncated: false };
}

