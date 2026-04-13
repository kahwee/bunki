import { Command } from "commander";
import { uploadImages } from "../../utils/image-uploader";

interface ImagesPushDeps {
  uploadImages: typeof uploadImages;
  logger: Pick<typeof console, "error">;
  exit: (code: number) => void;
}

const defaultDeps: ImagesPushDeps = {
  uploadImages,
  logger: console,
  exit: (code) => process.exit(code),
};

export async function handleImagesPushCommand(
  options: {
    domain?: string;
    images?: string;
    outputJson?: string;
    minYear?: string;
    maxYear?: string;
    contentAssets?: boolean;
    contentAssetsDir?: string;
  },
  deps: ImagesPushDeps = defaultDeps,
): Promise<void> {
  try {
    await deps.uploadImages({
      domain: options.domain,
      images: options.images,
      outputJson: options.outputJson,
      minYear: options.minYear ? parseInt(options.minYear, 10) : undefined,
      maxYear: options.maxYear ? parseInt(options.maxYear, 10) : undefined,
      contentAssets: options.contentAssets,
      contentAssetsDir: options.contentAssetsDir,
    });
  } catch (error) {
    deps.logger.error("Error uploading images:", error);
    deps.exit(1);
  }
}

export function registerImagesPushCommand(program: Command): Command {
  return program
    .command("images:push")
    .description("Upload images to S3-compatible storage")
    .option(
      "-d, --domain <domain>",
      "Domain name for bucket identification (defaults to domain in bunki.config.ts)",
    )
    .option("-i, --images <dir>", "Images directory path")
    .option("--output-json <file>", "Output URL mapping to JSON file")
    .option(
      "--min-year <year>",
      "Only upload images from the specified year onwards (e.g., 2023 uploads 2023, 2024, etc.)",
    )
    .option(
      "--max-year <year>",
      "Only upload images up to and including the specified year (e.g., 2023 uploads only up to 2023)",
    )
    .option(
      "--content-assets",
      "Upload from content/{year}/{assetsDir}/ with S3 key {year}/{filename}",
    )
    .option(
      "--content-assets-dir <dir>",
      "Assets subdirectory name within content/{year}/ (default: _assets, overrides contentAssets.assetsDir in config)",
    )
    .action(async (options) => {
      await handleImagesPushCommand(options);
    });
}
