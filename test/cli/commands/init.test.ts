import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "path";
import { handleInitCommand } from "../../../src/cli/commands/init";
import { fileExists } from "../../../src/utils/file-utils";

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
    // ensureDir creates a .gitkeep file to materialize directories
    expect(
      await fileExists(path.join(tmpRoot, "content", ".gitkeep")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", ".gitkeep")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "templates", "styles", ".gitkeep")),
    ).toBeTrue();
    expect(
      await fileExists(path.join(tmpRoot, "public", ".gitkeep")),
    ).toBeTrue();

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
});
