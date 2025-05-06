import { Glob } from "bun";
import path from "path";

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

export async function fileExists(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  return await file.exists();
}

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

export function getBaseFilename(
  filePath: string,
  extension: string = ".md",
): string {
  return path.basename(filePath, extension);
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await Bun.write(`${dirPath}/.gitkeep`, "");
  } catch (error) {
    // Directory already exists or error creating
  }
}

export async function copyFile(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  try {
    const sourceFile = Bun.file(sourcePath);
    const content = await sourceFile.arrayBuffer();
    await Bun.write(targetPath, content);
  } catch (error) {
    console.error(
      `Error copying file from ${sourcePath} to ${targetPath}:`,
      error,
    );
  }
}
