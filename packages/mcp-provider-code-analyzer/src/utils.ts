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

/**
 * Convert a user-provided name into a safe, filesystem-friendly slug.
 * - Removes path separators and invalid filename characters
 * - Normalizes whitespace and repeated dashes
 */
export function toSafeFilenameSlug(value: string): string {
    return value
        .trim()
        .replace(/[\\/:"*?<>|]+/g, "-")
        .replace(/\.+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "custom-rule";
}
