import { Glob } from 'bun';
import path from 'path';

/**
 * Finds all files matching a glob pattern in the specified directory
 * @param pattern Glob pattern to match
 * @param directory Base directory to search in
 * @param absolute Whether to return absolute paths (default: true)
 * @returns Array of file paths matching the pattern
 */
export async function findFilesByPattern(
  pattern: string,
  directory: string,
  absolute: boolean = true
): Promise<string[]> {
  const glob = new Glob(pattern);
  const files: string[] = [];

  for await (const file of glob.scan({
    cwd: directory,
    absolute
  })) {
    files.push(file);
  }

  return files;
}

/**
 * Checks if a file exists at the specified path
 * @param filePath Path to the file
 * @returns Promise that resolves to a boolean indicating if the file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  return await file.exists();
}

/**
 * Reads a file's contents as text
 * @param filePath Path to the file
 * @returns Promise that resolves to the file contents as a string, or null if the file doesn't exist
 */
export async function readFileAsText(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return null;
    }

    return await file.text();
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Extracts the base filename without extension
 * @param filePath Path to the file
 * @param extension File extension to remove (default: '.md')
 * @returns Filename without the extension
 */
export function getBaseFilename(filePath: string, extension: string = '.md'): string {
  return path.basename(filePath, extension);
}

/**
 * Creates a directory if it doesn't exist
 * @param dirPath Path to the directory to create
 * @returns Promise that resolves when the directory is created
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    // Create a .gitkeep file in the directory to ensure it exists
    await Bun.write(`${dirPath}/.gitkeep`, "");
  } catch (error) {
    // Directory already exists or error creating
  }
}

/**
 * Copies a file from source to target
 * @param sourcePath Source file path
 * @param targetPath Target file path
 * @returns Promise that resolves when the file is copied
 */
export async function copyFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    const sourceFile = Bun.file(sourcePath);
    const content = await sourceFile.arrayBuffer();
    await Bun.write(targetPath, content);
  } catch (error) {
    console.error(`Error copying file from ${sourcePath} to ${targetPath}:`, error);
  }
}