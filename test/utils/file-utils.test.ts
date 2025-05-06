import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import {
  findFilesByPattern,
  fileExists,
  readFileAsText,
  getBaseFilename,
  ensureDir,
  copyFile,
} from "../../src/utils/file-utils";
import path from "path";

const TEST_DIR = path.join(import.meta.dir, "../temp-dir");
const TEST_FILE = path.join(TEST_DIR, "test-file.txt");
const TEST_SUBDIR = path.join(TEST_DIR, "subdir");
const TEST_SUBFILE = path.join(TEST_SUBDIR, "subfile.txt");

describe("File Utilities", () => {
  // Set up test files
  beforeAll(async () => {
    // Clean up if test directory exists
    const dirFile = Bun.file(TEST_DIR);
    if (await dirFile.exists()) {
      await Bun.write(path.join(TEST_DIR, ".deleted"), ""); // Mark for deletion
    }

    // Create test directory and files
    await ensureDir(TEST_DIR);
    await Bun.write(TEST_FILE, "Test content");

    await ensureDir(TEST_SUBDIR);
    await Bun.write(TEST_SUBFILE, "Subfile content");
  });

  // Clean up after tests
  afterAll(async () => {
    // Always clean up the test directory
    const dirFile = Bun.file(TEST_DIR);
    if (await dirFile.exists()) {
      await Bun.write(path.join(TEST_DIR, ".deleted"), ""); // Mark for deletion
    }
  });

  test("findFilesByPattern should find files matching a pattern", async () => {
    const files = await findFilesByPattern("**/*.txt", TEST_DIR);

    expect(files).toBeArray();
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files).toContain(TEST_FILE);
    expect(files).toContain(TEST_SUBFILE);
  });

  test("findFilesByPattern should respect the absolute option", async () => {
    const relativeFiles = await findFilesByPattern("**/*.txt", TEST_DIR, false);

    expect(relativeFiles).toBeArray();
    expect(relativeFiles.length).toBeGreaterThanOrEqual(2);
    expect(relativeFiles[0]).not.toStartWith("/");
  });

  test("fileExists should check if a file exists", async () => {
    expect(await fileExists(TEST_FILE)).toBeTrue();
    expect(
      await fileExists(path.join(TEST_DIR, "non-existent.txt")),
    ).toBeFalse();
  });

  test("readFileAsText should read a file's contents", async () => {
    const content = await readFileAsText(TEST_FILE);

    expect(content).toBe("Test content");
  });

  test("readFileAsText should return null for non-existent files", async () => {
    const content = await readFileAsText(
      path.join(TEST_DIR, "non-existent.txt"),
    );

    expect(content).toBeNull();
  });

  test("getBaseFilename should extract the base filename", () => {
    expect(getBaseFilename("/path/to/file.md")).toBe("file");
    expect(getBaseFilename("/path/to/file.txt", ".txt")).toBe("file");
    expect(getBaseFilename("file.md")).toBe("file");
  });

  test("ensureDir should create a directory if it doesn't exist", async () => {
    const newDir = path.join(TEST_DIR, "new-dir");

    await ensureDir(newDir);

    const dirFile = Bun.file(path.join(newDir, ".gitkeep"));
    expect(await dirFile.exists()).toBeTrue();
  });

  test("copyFile should copy a file", async () => {
    const targetPath = path.join(TEST_DIR, "target.txt");

    await copyFile(TEST_FILE, targetPath);

    const targetFile = Bun.file(targetPath);
    expect(await targetFile.exists()).toBeTrue();

    const content = await targetFile.text();
    expect(content).toBe("Test content");
  });
});
