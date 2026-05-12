import path from "node:path";

// TODO: move this file into a `src/utils/` folder in a follow-up PR.
/**
 * Helper function to easily get an error message from a catch statement
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : /* istanbul ignore next */ String(error);
}

/**
 * Sanitize a user-provided path to prevent path traversal attacks.
 * Returns true if the path is safe to use, false otherwise.
 *
 * Based on dx-core's sanitization approach:
 * - Decodes URL-encoded sequences
 * - Normalizes Unicode characters
 * - Checks for path traversal patterns (.., Unicode ellipsis)
 * - Verifies the path is absolute
 * - Handles Windows drive-relative paths
 */
export function sanitizePath(userPath: string): boolean {
    // Decode URL-encoded sequences
    const decodedPath = decodeURIComponent(userPath);
    // Normalize Unicode characters
    const normalizedPath = decodedPath.normalize();

    // Check for various traversal patterns
    const hasTraversal =
        normalizedPath.includes('..') ||
        normalizedPath.includes('\u2025') || // Unicode horizontal ellipsis
        normalizedPath.includes('\u2026'); // Unicode vertical ellipsis

    // `path.isAbsolute` doesn't cover Windows's drive-relative path:
    // https://github.com/nodejs/node/issues/56766
    //
    // we can assume it's a drive-relative path if it starts with `\`.
    const isAbsolute =
        path.isAbsolute(userPath) && (process.platform === 'win32' ? !userPath.startsWith('\\') : true);

    return !hasTraversal && isAbsolute;
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
