import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { handleInitCommand } from "../../../src/cli/commands/init";
import { fileExists, isDirectory } from "../../../src/utils/file-utils";

let tmpRoot: string;

describe("CLI Init Command (modular)", () => {
  const originalCwd = process.cwd();

  beforeAll(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), "bunki-init-test-"));
    process.chdir(tmpRoot);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await rm(tmpRoot, { recursive: true, force: true });
  });

  test("should create default config, directories and starter files", async () => {
    await handleInitCommand({ config: "bunki.config.ts" });

    // Config
    expect(await fileExists(path.join(tmpRoot, "bunki.config.ts"))).toBeTrue();

    // Directories
    expect(await isDirectory(path.join(tmpRoot, "content"))).toBeTrue();
    expect(await isDirectory(path.join(tmpRoot, "templates"))).toBeTrue();
    expect(await isDirectory(path.join(tmpRoot, "templates", "styles"))).toBeTrue();
    expect(await isDirectory(path.join(tmpRoot, "public"))).toBeTrue();

    // Files
    expect(await fileExists(path.join(tmpRoot, "content", "welcome.md"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "base.njk"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "index.njk"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "post.njk"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "tag.njk"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "tags.njk"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "archive.njk"))).toBeTrue();
    expect(await fileExists(path.join(tmpRoot, "templates", "styles", "main.css"))).toBeTrue();
  });

  test("should be idempotent when config already exists", async () => {
    await handleInitCommand({ config: "bunki.config.ts" });
    // If it didn't throw, and files still exist, it's fine for now.
    expect(await fileExists(path.join(tmpRoot, "bunki.config.ts"))).toBeTrue();
  });

  test("should handle errors gracefully with custom dependencies", async () => {
    let errorLogged = "";
    let exitCode = -1;

    const failingDeps = {
      createDefaultConfig: async () => {
        throw new Error("Mock config creation failure");
      },
      ensureDir: async () => {},
      writeFile: async () => 0,
      logger: {
        log: () => {},
        error: (msg: string, _err: unknown) => {
          errorLogged = msg;
        },
      },
      exit: (_code: number) => {
        exitCode = _code;
      },
    };

    await handleInitCommand({ config: "bunki.config.ts" }, failingDeps);

    expect(errorLogged).toInclude("Error initializing");
    expect(exitCode).toBe(1);
  });

  test("should skip init and log message when config already exists", async () => {
    let loggedMessage = "";

    const mockDeps = {
      createDefaultConfig: async () => false, // Config already exists
      ensureDir: async () => {},
      writeFile: async () => 0,
      logger: {
        log: (msg: string) => {
          loggedMessage = msg;
        },
        error: () => {},
      },
      exit: (_code: number) => {},
    };

    await handleInitCommand({ config: "bunki.config.ts" }, mockDeps);

    expect(loggedMessage).toInclude("Skipped initialization");
  });
});
