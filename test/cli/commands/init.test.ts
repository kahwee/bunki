import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "path";
import { handleInitCommand } from "../../../src/cli/commands/init";
import { fileExists, isDirectory } from "../../../src/utils/file-utils";

const tmpRoot = path.join(process.cwd(), "test", "temp-cli-init");

describe("CLI Init Command (modular)", () => {
  const originalCwd = process.cwd();

  beforeAll(async () => {
    // Move into isolated temp directory for this test to avoid polluting repo
    // Using Bun shell to ensure a clean slate, then recreate
    await Bun.$`rm -rf ${tmpRoot}`.quiet();
    await Bun.$`mkdir -p ${tmpRoot}`.quiet();
    process.chdir(tmpRoot);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    // leave artifacts for debugging if needed
    // await Bun.$`rm -rf ${tmpRoot}`.quiet();
  });

  test("should create default config, directories and starter files", async () => {
    await handleInitCommand({ config: "bunki.config.ts" });

    // Config
    expect(await fileExists(path.join(tmpRoot, "bunki.config.ts"))).toBeTrue();

    // Directories
    expect(await isDirectory(path.join(tmpRoot, "content"))).toBeTrue();
    expect(await isDirectory(path.join(tmpRoot, "templates"))).toBeTrue();
    expect(
      await isDirectory(path.join(tmpRoot, "templates", "styles")),
    ).toBeTrue();
    expect(await isDirectory(path.join(tmpRoot, "public"))).toBeTrue();

    // Files
    expect(
      await fileExists(path.join(tmpRoot, "content", "welcome.md")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "base.njk")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "index.njk")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "post.njk")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "tag.njk")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "tags.njk")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "archive.njk")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "styles", "main.css")),
    ).toBeTrue();
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
        error: (msg: string, err: any) => {
          errorLogged = msg;
        },
      },
      exit: (code: number) => {
        exitCode = code;
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
      exit: (code: number) => {},
    };

    await handleInitCommand({ config: "bunki.config.ts" }, mockDeps);

    expect(loggedMessage).toInclude("Skipped initialization");
  });
});
