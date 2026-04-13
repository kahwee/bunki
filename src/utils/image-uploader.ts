import path from "path";
import { loadConfig } from "../config";
import { ImageUploadOptions, S3Config } from "../types";
import { ensureDir, fileExists } from "./file-utils";
import { createUploader } from "./s3-uploader";

// Constants
export const DEFAULT_IMAGES_DIR = path.join(process.cwd(), "assets");
export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content");

// Upload images implementation function
export async function uploadImages(
  options: ImageUploadOptions = {},
): Promise<Record<string, string>> {
  try {
    // In content-assets mode, scan content/ and strip /{assetsDir}/ from S3 keys
    const contentAssetsMode = options.contentAssets === true;
    const defaultDir = contentAssetsMode ? DEFAULT_CONTENT_DIR : DEFAULT_IMAGES_DIR;
    const imagesDir = path.resolve(options.images || defaultDir);

    // Check if images directory exists
    if (!(await fileExists(imagesDir))) {
      console.log(`Creating images directory at ${imagesDir}...`);
      await ensureDir(imagesDir);
    }

    const config = await loadConfig();

    // Use config's S3 settings directly
    if (!config.s3 && !process.env.BUNKI_DRY_RUN) {
      console.error(
        "Missing S3 configuration. Please check your bunki.config.ts or .env file.",
      );
      process.exit(1);
    }

    // Create S3 config either from config or as a stub for dry run
    let s3Config: S3Config;

    if (process.env.BUNKI_DRY_RUN === "true") {
      console.warn("Using stub S3 configuration for dry run");
      s3Config = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        publicUrl: "https://example.com",
        bucket: config.s3?.bucket || "test-bucket",
        endpoint: config.s3?.endpoint,
        region: config.s3?.region || "auto",
      };
    } else {
      if (!config.s3) {
        throw new Error("Missing S3 configuration in config");
      }

      s3Config = {
        ...config.s3,
        publicUrl: config.s3.publicUrl || config.publicUrl || "",
      };
    }

    // Resolve the assets directory name: CLI flag > config > default "_assets"
    const assetsDir =
      options.contentAssetsDir || config.contentAssets?.assetsDir || "_assets";

    if (contentAssetsMode) {
      // In content-assets mode, prefer the dedicated S3 config if provided in bunki.config.ts
      if (config.contentAssets?.s3) {
        s3Config = {
          ...config.contentAssets.s3,
          publicUrl: config.contentAssets.s3.publicUrl || s3Config.publicUrl,
        };
        console.log(`[content-assets] Using dedicated S3 config (bucket: ${s3Config.bucket})`);
      }

      console.log(
        `Uploading content assets from ${imagesDir} to bucket ${s3Config.bucket}`,
      );
      console.log(
        `[content-assets] S3 key: {year}/{filename} (/${assetsDir}/ stripped from path)`,
      );
    } else {
      console.log(
        `Uploading images from ${imagesDir} to bucket ${s3Config.bucket}`,
      );
    }

    if (options.minYear && options.maxYear) {
      console.log(`Filtering images from year ${options.minYear} to ${options.maxYear}`);
    } else if (options.minYear) {
      console.log(`Filtering images from year ${options.minYear} onwards`);
    } else if (options.maxYear) {
      console.log(`Filtering images up to year ${options.maxYear}`);
    }

    // In content-assets mode, strip /{assetsDir}/ from the relative path to form the S3 key.
    // e.g. "2025/_assets/image.webp" -> "2025/image.webp" (when assetsDir is "_assets")
    const escapedDir = assetsDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keyTransform = contentAssetsMode
      ? (filePath: string) => filePath.replace(new RegExp(`/${escapedDir}/`), "/")
      : undefined;

    const uploader = createUploader(s3Config);
    const imageUrlMap = await uploader.uploadImages(imagesDir, options.minYear, keyTransform, options.maxYear);

    // Output URL mapping to JSON if requested
    if (options.outputJson) {
      const outputFile = path.resolve(options.outputJson);
      await Bun.write(outputFile, JSON.stringify(imageUrlMap, null, 2));
      console.log(`Image URL mapping saved to ${outputFile}`);
    }

    // Print usage instructions
    if (Object.keys(imageUrlMap).length > 0) {
      console.log("\nUse these image URLs in your markdown files:");
      for (const [filename, url] of Object.entries(imageUrlMap)) {
        console.log(`${filename}: ![Alt text](${url})`);
      }
    }

    console.log("\nImage upload completed successfully!");
    return imageUrlMap;
  } catch (error) {
    console.error("Error uploading images:", error);
    throw error;
  }
}
