import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { Glob } from "bun";
import type { Command } from "commander";
import { isDirectory } from "../../utils/file-utils";

type MediaReference = {
  file: string;
  line: number;
  mediaPath: string;
  resolvedPath: string;
  exists: boolean;
  type: "image" | "video";
};

type MediaFile = {
  path: string;
  filename: string;
  year: string;
  size: number;
  location: "content/_assets" | "assets";
};

type ValidationResult = {
  totalMarkdownFiles: number;
  totalMediaReferences: number;
  missingReferences: MediaReference[];
  totalMediaFiles: number;
  referencedMediaCount: number;
  unusedMedia: MediaFile[];
  unusedMediaSize: number;
};

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const videoExtensions = new Set([".mp4", ".webm", ".mov"]);
const mediaExtensions = new Set([...imageExtensions, ...videoExtensions]);

export async function handleValidateMediaCommand(
  options: { contentDir?: string },
  deps = { logger: console, exit: (code: number) => process.exit(code) },
): Promise<void> {
  const contentDir = options.contentDir || join(process.cwd(), "content");
  const assetsDir = join(process.cwd(), "assets");

  if (!(await isDirectory(contentDir))) {
    deps.logger.error(`Content directory not found: ${contentDir}`);
    deps.exit(1);
    return;
  }

  deps.logger.log("🔍 Validating media files...\n");
  const result = await validateMedia(contentDir, assetsDir);

  deps.logger.log("📊 Validation Results:");
  deps.logger.log(`   Total markdown files: ${result.totalMarkdownFiles}`);
  deps.logger.log(`   Total media references: ${result.totalMediaReferences}`);
  deps.logger.log(`   Missing files: ${result.missingReferences.length}`);
  deps.logger.log(`   Total media files: ${result.totalMediaFiles}`);
  deps.logger.log(`   Referenced: ${result.referencedMediaCount}`);
  deps.logger.log(`   Unused: ${result.unusedMedia.length}`);
  deps.logger.log(`   Unused size: ${(result.unusedMediaSize / 1024 / 1024).toFixed(2)} MB`);

  if (result.missingReferences.length > 0) {
    deps.logger.log("\n❌ Missing Media Files:\n");
    for (const ref of result.missingReferences) {
      deps.logger.log(`  ${ref.file}:${ref.line}`);
      deps.logger.log(`    Referenced: ${ref.mediaPath}`);
      deps.logger.log(`    Expected at: ${ref.resolvedPath}`);
      deps.logger.log("");
    }
  }

  if (result.unusedMedia.length > 0) {
    deps.logger.log("\n⚠️  Unused Media Files:\n");
    const byLocation: Record<MediaFile["location"], MediaFile[]> = {
      "content/_assets": [],
      assets: [],
    };
    for (const file of result.unusedMedia) {
      byLocation[file.location].push(file);
    }

    for (const [location, files] of Object.entries(byLocation)) {
      if (files.length === 0) continue;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      deps.logger.log(
        `${location} (${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB):`,
      );
      for (const file of files.slice(0, 10)) {
        deps.logger.log(`  ${file.year}/${file.filename}`);
      }
      if (files.length > 10) {
        deps.logger.log(`  ... and ${files.length - 10} more`);
      }
      deps.logger.log("");
    }
  }

  if (result.missingReferences.length === 0 && result.unusedMedia.length === 0) {
    deps.logger.log("\n✅ All media files validated successfully!");
    deps.exit(0);
    return;
  }

  deps.exit(1);
}

async function validateMedia(contentDir: string, assetsDir: string): Promise<ValidationResult> {
  const [contentMedia, assetMedia] = await Promise.all([
    getAllMediaFromContentAssets(contentDir),
    getAllMediaFromAssets(assetsDir),
  ]);
  const allMediaFiles = [...contentMedia, ...assetMedia];
  const referencedMedia = new Set<string>();
  const missingReferences: MediaReference[] = [];
  let totalMarkdownFiles = 0;
  let totalMediaReferences = 0;

  const markdownGlob = new Glob("*/*.md");
  for await (const filePath of markdownGlob.scan({ cwd: contentDir, absolute: true })) {
    const year = basename(dirname(filePath));
    if (!/^\d{4}$/.test(year)) continue;

    totalMarkdownFiles += 1;
    const lines = (await Bun.file(filePath).text()).split("\n");

    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1;

      for (const match of line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
        const mediaPath = match[2];
        if (isRemoteMedia(mediaPath) || !imageExtensions.has(extname(mediaPath).toLowerCase())) {
          continue;
        }

        totalMediaReferences += 1;
        referencedMedia.add(basename(mediaPath));
        await checkMediaReference(filePath, lineNumber, mediaPath, "image", missingReferences);
      }

      for (const match of line.matchAll(/<video[^>]+src="([^"]+)"/g)) {
        const mediaPath = match[1];
        if (isRemoteMedia(mediaPath)) continue;

        totalMediaReferences += 1;
        referencedMedia.add(basename(mediaPath));
        await checkMediaReference(filePath, lineNumber, mediaPath, "video", missingReferences);
      }
    }
  }

  const unusedMedia = allMediaFiles.filter((media) => !referencedMedia.has(media.filename));
  return {
    totalMarkdownFiles,
    totalMediaReferences,
    missingReferences,
    totalMediaFiles: allMediaFiles.length,
    referencedMediaCount: referencedMedia.size,
    unusedMedia,
    unusedMediaSize: unusedMedia.reduce((sum, file) => sum + file.size, 0),
  };
}

async function getAllMediaFromContentAssets(contentDir: string): Promise<MediaFile[]> {
  if (!(await isDirectory(contentDir))) return [];

  const files: MediaFile[] = [];
  const glob = new Glob("*/_assets/*");
  for await (const filePath of glob.scan({ cwd: contentDir, absolute: true })) {
    const filename = basename(filePath);
    if (!mediaExtensions.has(extname(filename).toLowerCase())) continue;

    const year = basename(dirname(dirname(filePath)));
    if (!/^\d{4}$/.test(year)) continue;

    const file = Bun.file(filePath);
    files.push({
      path: filePath,
      filename,
      year,
      size: file.size,
      location: "content/_assets",
    });
  }
  return files;
}

async function getAllMediaFromAssets(assetsDir: string): Promise<MediaFile[]> {
  if (!(await isDirectory(assetsDir))) return [];

  const files: MediaFile[] = [];
  const glob = new Glob("*/*");
  for await (const filePath of glob.scan({ cwd: assetsDir, absolute: true })) {
    const filename = basename(filePath);
    if (!mediaExtensions.has(extname(filename).toLowerCase())) continue;

    const year = basename(dirname(filePath));
    if (!/^\d{4}$/.test(year)) continue;

    const file = Bun.file(filePath);
    const stat = await file.stat();
    if (!stat?.isFile()) continue;
    files.push({
      path: filePath,
      filename,
      year,
      size: stat.size,
      location: "assets",
    });
  }
  return files;
}

async function checkMediaReference(
  markdownFile: string,
  lineNumber: number,
  mediaPath: string,
  type: MediaReference["type"],
  missingReferences: MediaReference[],
): Promise<void> {
  const resolvedPath = resolve(dirname(markdownFile), mediaPath);
  if (await Bun.file(resolvedPath).exists()) return;

  missingReferences.push({
    file: relative(process.cwd(), markdownFile),
    line: lineNumber,
    mediaPath,
    resolvedPath: relative(process.cwd(), resolvedPath),
    exists: false,
    type,
  });
}

function isRemoteMedia(mediaPath: string): boolean {
  return /^(?:https?:)?\/\//i.test(mediaPath) || mediaPath.startsWith("data:");
}

export function registerValidateMediaCommand(program: Command): Command {
  return program
    .command("validate:media")
    .description("Validate media files (check for missing and unused files)")
    .option("-c, --content-dir <dir>", "Content directory path (default: ./content)")
    .action(async (options) => {
      await handleValidateMediaCommand(options);
    });
}
