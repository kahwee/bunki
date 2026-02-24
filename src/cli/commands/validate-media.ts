import { Command } from "commander";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join, dirname, resolve, basename } from "path";

interface MediaReference {
  file: string;
  line: number;
  mediaPath: string;
  resolvedPath: string;
  exists: boolean;
  type: "image" | "video";
}

interface MediaFile {
  path: string;
  filename: string;
  year: string;
  size: number;
  location: "content/_assets" | "assets";
}

interface ValidationResult {
  totalMarkdownFiles: number;
  totalMediaReferences: number;
  missingReferences: MediaReference[];
  totalMediaFiles: number;
  referencedMediaCount: number;
  unusedMedia: MediaFile[];
  unusedMediaSize: number;
}

const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const videoExtensions = [".mp4", ".webm", ".mov"];
const mediaExtensions = [...imageExtensions, ...videoExtensions];

export async function handleValidateMediaCommand(
  options: {
    contentDir?: string;
    fix?: boolean;
  },
  deps = { logger: console, exit: (code: number) => process.exit(code) }
): Promise<void> {
  const contentDir = options.contentDir || join(process.cwd(), "content");
  const assetsDir = join(process.cwd(), "assets");

  if (!existsSync(contentDir)) {
    deps.logger.error(`Content directory not found: ${contentDir}`);
    deps.exit(1);
  }

  deps.logger.log("🔍 Validating media files...\n");

  const result = validateMedia(contentDir, assetsDir);

  // Report results
  deps.logger.log("📊 Validation Results:");
  deps.logger.log(`   Total markdown files: ${result.totalMarkdownFiles}`);
  deps.logger.log(`   Total media references: ${result.totalMediaReferences}`);
  deps.logger.log(`   Missing files: ${result.missingReferences.length}`);
  deps.logger.log(`   Total media files: ${result.totalMediaFiles}`);
  deps.logger.log(`   Referenced: ${result.referencedMediaCount}`);
  deps.logger.log(`   Unused: ${result.unusedMedia.length}`);
  deps.logger.log(
    `   Unused size: ${(result.unusedMediaSize / 1024 / 1024).toFixed(2)} MB`
  );

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
    const byLocation: Record<string, MediaFile[]> = {
      "content/_assets": [],
      assets: [],
    };
    for (const file of result.unusedMedia) {
      byLocation[file.location].push(file);
    }

    for (const [location, files] of Object.entries(byLocation)) {
      if (files.length === 0) continue;
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      deps.logger.log(
        `${location} (${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB):`
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

  if (
    result.missingReferences.length === 0 &&
    result.unusedMedia.length === 0
  ) {
    deps.logger.log("\n✅ All media files validated successfully!");
    deps.exit(0);
  } else {
    deps.exit(1);
  }
}

function validateMedia(
  contentDir: string,
  assetsDir: string
): ValidationResult {
  let totalMarkdownFiles = 0;
  let totalMediaReferences = 0;
  const missingReferences: MediaReference[] = [];

  // Get all media files
  const allMediaFiles = [
    ...getAllMediaFromContentAssets(contentDir),
    ...getAllMediaFromAssets(assetsDir),
  ];

  // Get all referenced media
  const referencedMedia = new Set<string>();

  // Scan markdown files
  const years = readdirSync(contentDir).filter((f) => {
    const fullPath = join(contentDir, f);
    return statSync(fullPath).isDirectory() && /^\d{4}$/.test(f);
  });

  for (const year of years) {
    const yearDir = join(contentDir, year);
    const files = readdirSync(yearDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      totalMarkdownFiles++;
      const filePath = join(yearDir, file);
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Check markdown images: ![alt](path)
        const imageMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
        for (const match of imageMatches) {
          const mediaPath = match[2];
          if (mediaPath.startsWith("http")) continue;

          const ext = mediaPath
            .substring(mediaPath.lastIndexOf("."))
            .toLowerCase();
          if (!imageExtensions.includes(ext)) continue;

          totalMediaReferences++;
          referencedMedia.add(basename(mediaPath));
          checkMediaReference(filePath, lineNumber, mediaPath, "image", missingReferences);
        }

        // Check video tags: <video src="path"
        const videoMatches = line.matchAll(/<video[^>]+src="([^"]+)"/g);
        for (const match of videoMatches) {
          const mediaPath = match[1];
          if (mediaPath.startsWith("http")) continue;

          totalMediaReferences++;
          referencedMedia.add(basename(mediaPath));
          checkMediaReference(filePath, lineNumber, mediaPath, "video", missingReferences);
        }
      }
    }
  }

  // Find unused media
  const unusedMedia = allMediaFiles.filter(
    (media) => !referencedMedia.has(media.filename)
  );
  const unusedMediaSize = unusedMedia.reduce((sum, file) => sum + file.size, 0);

  return {
    totalMarkdownFiles,
    totalMediaReferences,
    missingReferences,
    totalMediaFiles: allMediaFiles.length,
    referencedMediaCount: referencedMedia.size,
    unusedMedia,
    unusedMediaSize,
  };
}

function getAllMediaFromContentAssets(contentDir: string): MediaFile[] {
  const mediaFiles: MediaFile[] = [];

  if (!existsSync(contentDir)) return [];

  const years = readdirSync(contentDir).filter((f) => {
    const fullPath = join(contentDir, f);
    return statSync(fullPath).isDirectory() && /^\d{4}$/.test(f);
  });

  for (const year of years) {
    const assetsDir = join(contentDir, year, "_assets");
    if (!existsSync(assetsDir)) continue;

    const files = readdirSync(assetsDir);
    for (const file of files) {
      const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
      if (!mediaExtensions.includes(ext)) continue;

      const filePath = join(assetsDir, file);
      const stats = statSync(filePath);

      mediaFiles.push({
        path: filePath,
        filename: file,
        year,
        size: stats.size,
        location: "content/_assets",
      });
    }
  }

  return mediaFiles;
}

function getAllMediaFromAssets(assetsDir: string): MediaFile[] {
  const mediaFiles: MediaFile[] = [];

  if (!existsSync(assetsDir)) return [];

  const years = readdirSync(assetsDir).filter((f) => {
    const fullPath = join(assetsDir, f);
    return statSync(fullPath).isDirectory() && /^\d{4}$/.test(f);
  });

  for (const year of years) {
    const yearDir = join(assetsDir, year);
    const files = readdirSync(yearDir).filter((f) => {
      const fullPath = join(yearDir, f);
      return statSync(fullPath).isFile();
    });

    for (const file of files) {
      const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
      if (!mediaExtensions.includes(ext)) continue;

      const filePath = join(yearDir, file);
      const stats = statSync(filePath);

      mediaFiles.push({
        path: filePath,
        filename: file,
        year,
        size: stats.size,
        location: "assets",
      });
    }
  }

  return mediaFiles;
}

function checkMediaReference(
  markdownFile: string,
  lineNumber: number,
  mediaPath: string,
  type: "image" | "video",
  missingReferences: MediaReference[]
): void {
  const markdownDir = dirname(markdownFile);
  const resolvedPath = resolve(markdownDir, mediaPath);

  if (!existsSync(resolvedPath)) {
    missingReferences.push({
      file: markdownFile.replace(process.cwd() + "/", ""),
      line: lineNumber,
      mediaPath,
      resolvedPath: resolvedPath.replace(process.cwd() + "/", ""),
      exists: false,
      type,
    });
  }
}

export function registerValidateMediaCommand(program: Command): Command {
  return program
    .command("validate:media")
    .description("Validate media files (check for missing and unused files)")
    .option(
      "-c, --content-dir <dir>",
      "Content directory path (default: ./content)"
    )
    .option("--fix", "Attempt to fix issues automatically")
    .action(async (options) => {
      await handleValidateMediaCommand(options);
    });
}
