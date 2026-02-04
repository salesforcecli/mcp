/**
 * Returns a list of AST node identifiers for the given source code.
 * Minimal implementation with zero external dependencies:
 * - For 'xml' or 'html' languages, returns tag names encountered in document order (unique, case-preserving).
 * - For other languages, returns an empty list (placeholder).
 *
 * This function is intentionally lightweight to avoid runtime dependencies.
 *
 * @param code - The source code as a string
 * @param language - The language of the source code (e.g., "xml", "html", "typescript", "javascript", "apex")
 * @returns An array of strings representing AST nodes
 */
export function getAstNodes(code: string, language: string): string[] {
  const lang = (language ?? '').toLowerCase().trim();
  if (lang === 'xml' || lang === 'html') {
    return extractXmlTagNames(code);
  }
  return [];
}

/**
 * Very lightweight XML/HTML tag name extractor.
 * - Collects tag names from opening tags and self-closing tags.
 * - Skips closing tags and comments/doctype/cdata.
 * - Preserves first-seen case and de-duplicates by lowercase.
 */
function extractXmlTagNames(xmlLike: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const re = /<\s*([A-Za-z_][\w.\-:]*)\b(?![^>]*\/?>\s*<\/)/g; // match opening or self-closing, not closing
  // Also allow self-closing like <br/>
  // Exclude declarations/comments: handled implicitly since they start with <! or <? which won't match group 1
  let m: RegExpExecArray | null;
  while ((m = re.exec(xmlLike)) !== null) {
    const name = m[1];
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(name);
    }
  }
  return results;
}
