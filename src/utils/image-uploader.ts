import path from "path";
import { loadConfig } from "../config";
import { ImageUploadOptions, S3Config } from "../types";
import { ensureDir, fileExists } from "./file-utils";
import { createUploader } from "./s3-uploader";

// Constants
export const DEFAULT_IMAGES_DIR = path.join(process.cwd(), "images");

// Upload images implementation function
export async function uploadImages(
  options: ImageUploadOptions = {},
): Promise<Record<string, string>> {
  try {
    const imagesDir = path.resolve(options.images || DEFAULT_IMAGES_DIR);

    // Check if images directory exists
    if (!(await fileExists(imagesDir))) {
      // Create images directory if not exists
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
      // Use the S3 config from bunki.config.ts
      if (!config.s3) {
        throw new Error("Missing S3 configuration in config");
      }

      s3Config = {
        ...config.s3,
        publicUrl: config.s3.publicUrl || config.publicUrl || "",
      };
    }

    console.log(
      `Uploading images from ${imagesDir} to bucket ${s3Config.bucket}`,
    );

    // Create uploader and upload images
    const uploader = createUploader(s3Config);
    const imageUrlMap = await uploader.uploadImages(imagesDir);

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
    process.exit(1);
  }
}
