import { Glob } from "bun";
import path from "path";
import fs from "fs";

/**
 * Find files matching a glob pattern in a directory
 * @param pattern - Glob pattern to match (e.g., "*.md", "**\/\*.ts")
 * @param directory - Directory to search in
 * @param absolute - Return absolute paths (default: true)
 * @returns Array of matching file paths
 */
export async function findFilesByPattern(
  pattern: string,
  directory: string,
  absolute: boolean = true,
): Promise<string[]> {
  const glob = new Glob(pattern);
  const files: string[] = [];

  for await (const file of glob.scan({
    cwd: directory,
    absolute,
  })) {
    files.push(file);
  }

  return files;
}

/**
 * Check if a file exists
 * @param filePath - Path to file
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    return await file.exists();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file (not a directory)
 * @param filePath - Path to check
 * @returns True if path is a file
 */
export async function isFile(filePath: string): Promise<boolean> {
  try {
    const stat = await Bun.file(filePath).stat();
    return stat?.isFile() ?? false;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory
 * @param dirPath - Path to check
 * @returns True if path is a directory
 */
export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await Bun.file(dirPath).stat();
    return stat?.isDirectory() ?? false;
  } catch {
    return false;
  }
}

/**
 * Read file as text
 * @param filePath - Path to file
 * @returns File contents or null if file doesn't exist
 */
export async function readFileAsText(filePath: string): Promise<string | null> {
  try {
    if (!(await fileExists(filePath))) {
      return null;
    }

    const content = await Bun.file(filePath).text();
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Read file as binary buffer
 * @param filePath - Path to file
 * @returns File contents as Uint8Array or null if file doesn't exist
 */
export async function readFileAsBuffer(
  filePath: string,
): Promise<Uint8Array | null> {
  try {
    if (!(await fileExists(filePath))) {
      return null;
    }

    const buffer = await Bun.file(filePath).arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Write text to a file
 * @param filePath - Path to file
 * @param content - Text content to write
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await Bun.write(filePath, content);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Write binary data to a file
 * @param filePath - Path to file
 * @param data - Binary data to write
 */
export async function writeFileBuffer(
  filePath: string,
  data: Uint8Array | ArrayBuffer,
): Promise<void> {
  try {
    await Bun.write(filePath, data);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Get base filename without extension
 * @param filePath - Path to file
 * @param extension - Extension to remove (default: ".md")
 * @returns Base filename
 */
export function getBaseFilename(
  filePath: string,
  extension: string = ".md",
): string {
  return path.basename(filePath, extension);
}

/**
 * Create a directory (creates parent directories if needed)
 * @param dirPath - Path to create
 */
export async function createDir(dirPath: string): Promise<void> {
  try {
    // Try to create directory with recursive flag
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Check if it already exists as a directory
    if (await isDirectory(dirPath)) {
      return;
    }

    // Check if path exists as a file
    if (await fileExists(dirPath)) {
      throw new Error(`Path exists but is not a directory: ${dirPath}`);
    }

    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Ensure a directory exists (alias for createDir)
 * @param dirPath - Path to ensure exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  return createDir(dirPath);
}

/**
 * Copy a file from source to target
 * @param sourcePath - Source file path
 * @param targetPath - Target file path
 */
export async function copyFile(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  try {
    const sourceFile = Bun.file(sourcePath);

    if (!(await sourceFile.exists())) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }

    const buffer = await sourceFile.arrayBuffer();
    await Bun.write(targetPath, buffer);
  } catch (error) {
    console.error(
      `Error copying file from ${sourcePath} to ${targetPath}:`,
      error,
    );
    throw error;
  }
}

/**
 * Delete a file
 * @param filePath - Path to file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    if (!(await fileExists(filePath))) {
      return; // File doesn't exist, nothing to delete
    }

    await Bun.file(filePath).unlink();
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Get file size in bytes
 * @param filePath - Path to file
 * @returns File size or null if file doesn't exist
 */
export async function getFileSize(filePath: string): Promise<number | null> {
  try {
    const stat = await Bun.file(filePath).stat();
    return stat?.size ?? null;
  } catch {
    return null;
  }
}

/**
 * Get file modification time
 * @param filePath - Path to file
 * @returns Modification time as number (ms since epoch) or null if file doesn't exist
 */
export async function getFileMtime(filePath: string): Promise<number | null> {
  try {
    const stat = await Bun.file(filePath).stat();
    return stat?.mtime?.getTime() ?? null;
  } catch {
    return null;
  }
}

/**
 * List files in a directory
 * @param dirPath - Directory path
 * @param recursive - Include subdirectories (default: false)
 * @returns Array of file paths
 */
export async function listDir(
  dirPath: string,
  recursive: boolean = false,
): Promise<string[]> {
  try {
    const pattern = recursive ? "**/*" : "*";
    return await findFilesByPattern(pattern, dirPath, true);
  } catch (error) {
    console.error(`Error listing directory ${dirPath}:`, error);
    return [];
  }
}
