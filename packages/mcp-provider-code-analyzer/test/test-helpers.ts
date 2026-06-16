import { execFileSync } from 'node:child_process';

/**
 * Checks if Java 11+ is available on the system.
 * PMD and CPD engines require Java 11 or higher.
 */
export function isJavaAvailable(): boolean {
    try {
        const output = execFileSync('java', ['-version'], { encoding: 'utf-8', stdio: 'pipe' });
        // Check if output contains version information
        // Java version format: "java version "11.0.x"" or "openjdk version "11.0.x""
        const versionMatch = output.match(/version "(\d+)\.(\d+)/);
        if (versionMatch) {
            const majorVersion = parseInt(versionMatch[1], 10);
            // Java 11+ is required
            return majorVersion >= 11;
        }
        return false;
    } catch (error: any) {
        // Try to parse version from stderr if it's in the error message
        if (error.stderr) {
            const versionMatch = error.stderr.toString().match(/version "(\d+)\.(\d+)/);
            if (versionMatch) {
                const majorVersion = parseInt(versionMatch[1], 10);
                return majorVersion >= 11;
            }
        }
        return false;
    }
}
