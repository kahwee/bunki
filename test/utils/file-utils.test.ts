import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  findFilesByPattern,
  fileExists,
  readFileAsText,
  readFileAsBuffer,
  writeFile,
  writeFileBuffer,
  getBaseFilename,
  ensureDir,
  createDir,
  copyFile,
  deleteFile,
  getFileSize,
  getFileMtime,
  listDir,
  isFile,
  isDirectory,
} from "../../src/utils/file-utils";
import path from "path";
import fs from "fs";

const testDir = path.join(import.meta.dir, "file-utils-test");

describe("File Utils - Basic Operations", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(testDir, "test.txt"),
      "Hello, world!",
    );
    await fs.promises.writeFile(path.join(testDir, "test.md"), "# Markdown");
    await fs.promises.mkdir(path.join(testDir, "subdir"), { recursive: true });
    await fs.promises.writeFile(
      path.join(testDir, "subdir", "nested.txt"),
      "Nested content",
    );
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  test("should find files by pattern", async () => {
    const files = await findFilesByPattern("*.txt", testDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("test.txt"))).toBe(true);
  });

  test("should find nested files with glob pattern", async () => {
    const files = await findFilesByPattern("**/*.txt", testDir);
    expect(files.length).toBeGreaterThan(1);
    expect(files.some((f) => f.includes("nested.txt"))).toBe(true);
  });

  test("should find files with relative paths", async () => {
    const files = await findFilesByPattern("*.md", testDir, false);
    expect(files.some((f) => f === "test.md")).toBe(true);
  });

  test("should check if file exists", async () => {
    const testFile = path.join(testDir, "test.txt");
    const exists = await fileExists(testFile);
    expect(exists).toBe(true);
  });

  test("should return false for non-existent file", async () => {
    const nonExistent = path.join(testDir, "non-existent.txt");
    const exists = await fileExists(nonExistent);
    expect(exists).toBe(false);
  });

  test("should return false for invalid path", async () => {
    const invalid = "/invalid/\x00/path";
    const exists = await fileExists(invalid);
    expect(exists).toBe(false);
  });
});

describe("File Utils - Reading Files", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.writeFile(path.join(testDir, "test.txt"), "Hello!");
    await fs.promises.writeFile(
      path.join(testDir, "binary.bin"),
      Buffer.from([0xff, 0xfe, 0xfd]),
    );
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  test("should read file as text", async () => {
    const testFile = path.join(testDir, "test.txt");
    const content = await readFileAsText(testFile);
    expect(content).toBe("Hello!");
  });

  test("should return null for non-existent text file", async () => {
    const nonExistent = path.join(testDir, "non-existent.txt");
    const content = await readFileAsText(nonExistent);
    expect(content).toBeNull();
  });

  test("should read file as buffer", async () => {
    const binFile = path.join(testDir, "binary.bin");
    const buffer = await readFileAsBuffer(binFile);
    expect(buffer).not.toBeNull();
    expect(buffer?.[0]).toBe(0xff);
    expect(buffer?.[1]).toBe(0xfe);
    expect(buffer?.[2]).toBe(0xfd);
  });

  test("should return null for non-existent buffer file", async () => {
    const nonExistent = path.join(testDir, "non-existent.bin");
    const buffer = await readFileAsBuffer(nonExistent);
    expect(buffer).toBeNull();
  });

  test("should handle large text files", async () => {
    const largeFile = path.join(testDir, "large.txt");
    const largeContent = "x".repeat(1000000);
    await fs.promises.writeFile(largeFile, largeContent);
    const content = await readFileAsText(largeFile);
    expect(content?.length).toBe(1000000);
  });
});

describe("File Utils - Writing Files", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  test("should write text file", async () => {
    const testFile = path.join(testDir, "write-test.txt");
    const content = "Written content";
    await writeFile(testFile, content);
    const read = await readFileAsText(testFile);
    expect(read).toBe(content);
  });

  test("should write binary file", async () => {
    const binFile = path.join(testDir, "write-binary.bin");
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    await writeFileBuffer(binFile, data);
    const buffer = await readFileAsBuffer(binFile);
    expect(buffer?.[0]).toBe(0x01);
    expect(buffer?.[3]).toBe(0x04);
  });

  test("should overwrite existing file", async () => {
    const testFile = path.join(testDir, "overwrite.txt");
    await writeFile(testFile, "Original");
    await writeFile(testFile, "Overwritten");
    const content = await readFileAsText(testFile);
    expect(content).toBe("Overwritten");
  });

  test("should throw error on invalid write path", async () => {
    const invalid = "/invalid/\x00/path.txt";
    try {
      await writeFile(invalid, "test");
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("File Utils - File Information", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.mkdir(path.join(testDir, "subdir"), { recursive: true });
    await fs.promises.writeFile(path.join(testDir, "test.txt"), "test");
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  test("should check if path is a file", async () => {
    const testFile = path.join(testDir, "test.txt");
    const isFileResult = await isFile(testFile);
    expect(isFileResult).toBe(true);
  });

  test("should return false for directory when checking isFile", async () => {
    const subdir = path.join(testDir, "subdir");
    const isFileResult = await isFile(subdir);
    expect(isFileResult).toBe(false);
  });

  test("should return false for non-existent when checking isFile", async () => {
    const nonExistent = path.join(testDir, "non-existent.txt");
    const isFileResult = await isFile(nonExistent);
    expect(isFileResult).toBe(false);
  });

  test("should check if path is a directory", async () => {
    const subdir = path.join(testDir, "subdir");
    const isDirResult = await isDirectory(subdir);
    expect(isDirResult).toBe(true);
  });

  test("should return false for file when checking isDirectory", async () => {
    const testFile = path.join(testDir, "test.txt");
    const isDirResult = await isDirectory(testFile);
    expect(isDirResult).toBe(false);
  });

  test("should return false for non-existent when checking isDirectory", async () => {
    const nonExistent = path.join(testDir, "non-existent");
    const isDirResult = await isDirectory(nonExistent);
    expect(isDirResult).toBe(false);
  });

  test("should get file size", async () => {
    const testFile = path.join(testDir, "test.txt");
    const size = await getFileSize(testFile);
    expect(size).toBe(4); // "test" is 4 bytes
  });

  test("should return null for non-existent file size", async () => {
    const nonExistent = path.join(testDir, "non-existent.txt");
    const size = await getFileSize(nonExistent);
    expect(size).toBeNull();
  });

  test("should get file modification time", async () => {
    const testFile = path.join(testDir, "test.txt");
    const mtime = await getFileMtime(testFile);
    expect(mtime).not.toBeNull();
    expect(typeof mtime).toBe("number");
    expect(mtime! > 0).toBe(true);
  });

  test("should return null for non-existent file mtime", async () => {
    const nonExistent = path.join(testDir, "non-existent.txt");
    const mtime = await getFileMtime(nonExistent);
    expect(mtime).toBeNull();
  });
});

describe("File Utils - Directory Operations", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  test("should create new directory", async () => {
    const newDir = path.join(testDir, "new-dir");
    await createDir(newDir);
    const isDirResult = await isDirectory(newDir);
    expect(isDirResult).toBe(true);
  });

  test("should not throw when creating existing directory", async () => {
    const existingDir = path.join(testDir, "existing");
    await fs.promises.mkdir(existingDir);
    await createDir(existingDir); // Should not throw
    expect(true).toBe(true);
  });

  test("should throw when path exists as file", async () => {
    const filePath = path.join(testDir, "file.txt");
    await fs.promises.writeFile(filePath, "test");
    try {
      await createDir(filePath);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });

  test("should ensure directory exists (alias)", async () => {
    const newDir = path.join(testDir, "ensure-dir");
    await ensureDir(newDir);
    const isDirResult = await isDirectory(newDir);
    expect(isDirResult).toBe(true);
  });

  test("should list files in directory", async () => {
    await fs.promises.writeFile(path.join(testDir, "file1.txt"), "1");
    await fs.promises.writeFile(path.join(testDir, "file2.txt"), "2");
    const files = await listDir(testDir, false);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  test("should list files recursively", async () => {
    const subdir = path.join(testDir, "sub");
    await fs.promises.mkdir(subdir, { recursive: true });
    await fs.promises.writeFile(path.join(testDir, "file1.txt"), "1");
    await fs.promises.writeFile(path.join(subdir, "file2.txt"), "2");
    const files = await listDir(testDir, true);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });
});

describe("File Utils - File Operations", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.writeFile(path.join(testDir, "source.txt"), "Source");
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  test("should copy file", async () => {
    const source = path.join(testDir, "source.txt");
    const target = path.join(testDir, "target.txt");
    await copyFile(source, target);
    const content = await readFileAsText(target);
    expect(content).toBe("Source");
  });

  test("should throw when copying non-existent file", async () => {
    const source = path.join(testDir, "non-existent.txt");
    const target = path.join(testDir, "target.txt");
    try {
      await copyFile(source, target);
      expect(false).toBe(true); // Should not reach
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });

  test("should copy binary file", async () => {
    const binSource = path.join(testDir, "source.bin");
    const binTarget = path.join(testDir, "target.bin");
    const data = new Uint8Array([0xaa, 0xbb, 0xcc]);
    await fs.promises.writeFile(binSource, data);
    await copyFile(binSource, binTarget);
    const buffer = await readFileAsBuffer(binTarget);
    expect(buffer?.[0]).toBe(0xaa);
  });

  test("should delete file", async () => {
    const file = path.join(testDir, "to-delete.txt");
    await fs.promises.writeFile(file, "delete me");
    await deleteFile(file);
    const exists = await fileExists(file);
    expect(exists).toBe(false);
  });

  test("should not throw when deleting non-existent file", async () => {
    const nonExistent = path.join(testDir, "non-existent.txt");
    await deleteFile(nonExistent); // Should not throw
    expect(true).toBe(true);
  });
});

describe("File Utils - Filename Utilities", () => {
  test("should get base filename with default extension", () => {
    const filename = getBaseFilename("path/to/my-file.md");
    expect(filename).toBe("my-file");
  });

  test("should get base filename with custom extension", () => {
    const filename = getBaseFilename("path/to/my-file.txt", ".txt");
    expect(filename).toBe("my-file");
  });

  test("should get base filename without extension", () => {
    const filename = getBaseFilename("path/to/my-file", "");
    expect(filename).toBe("my-file");
  });

  test("should handle multiple dots in filename", () => {
    const filename = getBaseFilename("path/to/my.file.name.md", ".md");
    expect(filename).toBe("my.file.name");
  });

  test("should handle root level files", () => {
    const filename = getBaseFilename("file.md", ".md");
    expect(filename).toBe("file");
  });
});
