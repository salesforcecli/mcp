
/**
 * Helper function to easily get an error message from a catch statement
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : /* istanbul ignore next */ String(error);
}