import { describe, expect, it, vi, afterEach } from "vitest";
import path from "node:path";
import { PmdCliAstXmlAdapter } from "../../src/ast/pmd-cli-adapter.js";

const mkdtempMock = vi.fn();
const writeFileMock = vi.fn();
const rmMock = vi.fn();
const execFileMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    mkdtemp: (path: string) => mkdtempMock(path),
    writeFile: (path: string, content: string, encoding: string) => writeFileMock(path, content, encoding),
    rm: (path: string, options: { recursive: boolean; force: boolean }) => rmMock(path, options)
  }
}));

vi.mock("node:child_process", () => {
  const execFile = (
    cmd: string,
    args: string[],
    options: { maxBuffer: number },
    cb: (err: Error | null, stdout: string, stderr: string) => void
  ) => execFileMock(cmd, args, options, cb);

  (execFile as unknown as Record<symbol, unknown>)[Symbol.for("nodejs.util.promisify.custom")] = (
    cmd: string,
    args: string[],
    options: { maxBuffer: number }
  ) =>
    new Promise((resolve, reject) => {
      execFileMock(cmd, args, options, (err: Error | null, stdout: string, stderr: string) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ stdout, stderr });
      });
    });

  return { execFile };
});


describe("PmdCliAstXmlAdapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("generates AST XML via the PMD CLI and cleans up temp files", async () => {
    mkdtempMock.mockResolvedValueOnce("/tmp/pmd-ast-123");
    writeFileMock.mockResolvedValueOnce(undefined);
    rmMock.mockResolvedValueOnce(undefined);
    execFileMock.mockImplementationOnce((_cmd, _args, _options, cb) => cb(null, "<xml/>", ""));

    const adapter = new PmdCliAstXmlAdapter();

    const result = await adapter.generateAstXml("class X {}", "apex");

    expect(result).toBe("<xml/>");
    expect(mkdtempMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(rmMock).toHaveBeenCalledTimes(1);

    const execArgs = execFileMock.mock.calls[0];
    expect(execArgs[0]).toBe("pmd");
    expect(execArgs[1]).toEqual([
      "ast-dump",
      "--language",
      "apex",
      "--format",
      "xml",
      "--file",
      path.join("/tmp/pmd-ast-123", "source.apex")
    ]);
  });

  it("throws a helpful error when PMD CLI is missing", async () => {
    mkdtempMock.mockResolvedValueOnce("/tmp/pmd-ast-123");
    writeFileMock.mockResolvedValueOnce(undefined);
    rmMock.mockResolvedValueOnce(undefined);
    execFileMock.mockImplementationOnce((_cmd, _args, _options, cb) => cb(new Error("ENOENT: pmd not found"), "", ""));

    const adapter = new PmdCliAstXmlAdapter();

    await expect(adapter.generateAstXml("class X {}", "apex"))
      .rejects.toThrow("PMD CLI not found on PATH");
  });

  it("throws a generic error when PMD CLI fails", async () => {
    mkdtempMock.mockResolvedValueOnce("/tmp/pmd-ast-123");
    writeFileMock.mockResolvedValueOnce(undefined);
    rmMock.mockResolvedValueOnce(undefined);
    execFileMock.mockImplementationOnce((_cmd, _args, _options, cb) => cb(new Error("bad stuff"), "", ""));

    const adapter = new PmdCliAstXmlAdapter();

    await expect(adapter.generateAstXml("class X {}", "apex"))
      .rejects.toThrow("Failed to generate AST XML via PMD: bad stuff");
  });

  it("falls back to .txt when language is empty", async () => {
    mkdtempMock.mockResolvedValueOnce("/tmp/pmd-ast-123");
    writeFileMock.mockResolvedValueOnce(undefined);
    rmMock.mockResolvedValueOnce(undefined);
    execFileMock.mockImplementationOnce((_cmd, _args, _options, cb) => cb(null, "<xml/>", ""));

    const adapter = new PmdCliAstXmlAdapter();
    await adapter.generateAstXml("class X {}", "");

    const execArgs = execFileMock.mock.calls[0];
    expect(execArgs[1]).toEqual([
      "ast-dump",
      "--language",
      "",
      "--format",
      "xml",
      "--file",
      path.join("/tmp/pmd-ast-123", "source.txt")
    ]);
  });
});
