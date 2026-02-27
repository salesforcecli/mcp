import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Manages temporary copies of fixture files for evaluation runs.
 * Copies fixtures to a temp directory so the tool receives absolute paths,
 * and cleans up after the evaluation completes.
 */
export class FixtureManager {
  private readonly fixturesDir: string;
  private tempDir: string | null = null;

  constructor(fixturesDir: string) {
    this.fixturesDir = fixturesDir;
  }

  /**
   * Initializes a temporary directory for this evaluation run.
   */
  init(): void {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-eval-"));
  }

  /**
   * Copies a fixture file to the temp directory and returns absolute paths.
   *
   * @param fixtureRelPath - Path relative to eval/fixtures/ (e.g., "simple/single-ggd.cls")
   * @returns Object with filePath (absolute path to copied file) and directory (temp dir)
   */
  prepare(fixtureRelPath: string): { filePath: string; directory: string } {
    if (!this.tempDir) {
      throw new Error("FixtureManager not initialized. Call init() first.");
    }

    const sourcePath = path.join(this.fixturesDir, fixtureRelPath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Fixture file not found: ${sourcePath}`);
    }

    // Preserve the directory structure in temp
    const targetDir = path.join(this.tempDir, path.dirname(fixtureRelPath));
    fs.mkdirSync(targetDir, { recursive: true });

    const targetPath = path.join(targetDir, path.basename(fixtureRelPath));
    fs.copyFileSync(sourcePath, targetPath);

    return {
      filePath: targetPath,
      directory: this.tempDir,
    };
  }

  /**
   * Returns the temp directory path (for use as working directory).
   */
  getTempDir(): string {
    if (!this.tempDir) {
      throw new Error("FixtureManager not initialized. Call init() first.");
    }
    return this.tempDir;
  }

  /**
   * Cleans up the temporary directory and all copied fixtures.
   */
  cleanup(): void {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch {
        // Temp directory will be cleaned up by OS eventually
      }
      this.tempDir = null;
    }
  }
}
