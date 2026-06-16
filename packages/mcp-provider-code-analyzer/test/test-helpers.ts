import { spawnSync } from 'node:child_process';

/**
 * Checks if Java 11+ is available on the system.
 * PMD and CPD engines require Java 11 or higher.
 */
export function isJavaAvailable(): boolean {
    try {
        // Use spawnSync to properly capture stderr where java -version outputs
        const result = spawnSync('java', ['-version'], {
            encoding: 'utf-8',
            shell: false
        });

        // java -version outputs to stderr, not stdout
        const output = result.stderr || result.stdout || '';

        // Check for version information
        // Java version format: "java version "11.0.x"" or "openjdk version "11.0.x""
        const versionMatch = output.match(/version "(\d+)\.(\d+)/);
        if (versionMatch) {
            const majorVersion = parseInt(versionMatch[1], 10);
            // Java 11+ is required
            return majorVersion >= 11;
        }

        // If no version pattern found, Java is not properly available
        return false;
    } catch (error) {
        // If java command fails, it's not available
        return false;
    }
}
