// TODO: move this file into a `src/utils/` folder in a follow-up PR.
/**
 * Helper function to easily get an error message from a catch statement
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : /* istanbul ignore next */ String(error);
}

/**
 * Escape XML special characters for safe attribute/text usage.
 */
export function escapeXml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&apos;");
}
