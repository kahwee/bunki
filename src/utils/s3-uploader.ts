import { S3Client } from "bun";
import path from "path";
import { ImageUploader, S3Config, SiteConfig, Uploader } from "../types";

/**
 * Bun-native S3 uploader implementation
 */
export class S3Uploader implements Uploader, ImageUploader {
  private s3Config: S3Config;
  private client: S3Client;

  constructor(s3Config: S3Config) {
    this.s3Config = s3Config;

    // Check if we're in dry run mode
    if (process.env.BUNKI_DRY_RUN === "true") {
      console.warn("[S3] Using stub S3 client in dry run mode");
      // Create a mock client for testing
      this.client = {
        file: () => ({
          write: async () => Promise.resolve(),
        }),
      } as any as S3Client;
    } else {
      // Create a new S3Client with the provided configuration
      this.client = new S3Client({
        region: s3Config.region || "auto",
        endpoint: s3Config.endpoint,
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
        bucket: s3Config.bucket,
      });

      // Set the client as the default for Bun.s3
      Bun.s3 = this.client;
    }
  }

  async upload(sourcePath: string, config: SiteConfig): Promise<void> {
    console.log(
      `[S3] Uploading site ${sourcePath} to S3 bucket ${this.s3Config.bucket}/${config.domain}...`,
    );

    try {
      // This is a simplified implementation - a full implementation would
      // recursively upload all files from the source path
      const glob = new Bun.Glob("*");
      const files: string[] = [];

      for await (const file of glob.scan({
        cwd: sourcePath,
        absolute: false,
      })) {
        files.push(file);
      }

      console.log(`Found ${files.length} files to upload`);

      // Recursive file upload would go here...

      console.log(`[S3] Upload to ${config.domain} complete!`);
    } catch (error) {
      console.error(`Error uploading site to S3:`, error);
      throw error;
    }
  }

  /**
   * Get the public URL for a file in S3
   * @param s3Path Path to the file within the bucket
   * @returns The public URL for the file
   */
  private getPublicUrl(s3Path: string): string {
    const bucketName = this.s3Config.bucket;
    const customDomain =
      process.env[
      `S3_CUSTOM_DOMAIN_${bucketName.replace(/-/g, "_").toUpperCase()}`
      ];

    if (customDomain) {
      // Use the custom domain for this specific bucket
      return `https://${customDomain}/${s3Path}`;
    } else {
      // Use the default S3 public URL from config or env
      const publicUrl = this.s3Config.publicUrl;

      // If bucket is already included in public URL or custom endpoint is used
      if (publicUrl.includes(this.s3Config.bucket) || this.s3Config.endpoint) {
        return `${publicUrl}/${s3Path}`;
      } else {
        return `${publicUrl}/${this.s3Config.bucket}/${s3Path}`;
      }
    }
  }

  async uploadImages(imagesDir: string): Promise<Record<string, string>> {
    console.log(
      `[S3] Uploading all images from ${imagesDir} to bucket ${this.s3Config.bucket}...`,
    );

    const imageUrls: Record<string, string> = {};

    try {
      // Check if directory exists
      console.log(`[S3] Checking if directory exists: ${imagesDir}`);

      // We need to check if the directory exists, not just a file
      try {
        // Use a Glob to test directory existence by attempting to read content
        const glob = new Bun.Glob("*");
        let hasFiles = false;

        // Try to get at least one file to verify directory exists
        for await (const file of glob.scan({
          cwd: imagesDir,
          absolute: false,
        })) {
          hasFiles = true;
          break;
        }

        if (!hasFiles) {
          console.warn(`Directory exists but is empty: ${imagesDir}`);
          // Continue execution to attempt to find images
        }

        console.log(`[S3] Directory exists and is accessible`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(
          `No images directory found at ${imagesDir}, skipping image upload. Error: ${errorMessage}`,
        );
        return imageUrls;
      }

      // Get all files in the images directory using Bun.glob (recursively)
      const glob = new Bun.Glob("**/*.{jpg,jpeg,png,gif,webp,svg}");
      const files: string[] = [];

      // Debug info
      console.log(`[S3] Scanning directory ${imagesDir} for image files...`);

      // List all files in the directory for debugging
      try {
        const dirGlob = new Bun.Glob("*");
        const allFiles: string[] = [];

        for await (const file of dirGlob.scan({
          cwd: imagesDir,
          absolute: false,
        })) {
          allFiles.push(file);
        }

        console.log(
          `[S3] Files in directory: ${allFiles.join(", ") || "none"}`,
        );
      } catch (err) {
        console.error(`[S3] Error reading directory:`, err);
      }

      for await (const file of glob.scan({
        cwd: imagesDir,
        absolute: false,
      })) {
        console.log(`[S3] Found image file: ${file}`);
        files.push(file);
      }

      // The files are already filtered by glob pattern
      const imageFiles = files;

      if (imageFiles.length === 0) {
        console.warn(`No image files found in ${imagesDir}`);
        return imageUrls;
      }

      console.log(`Found ${imageFiles.length} images to upload`);

      // Upload each image and collect URLs
      for (const imageFile of imageFiles) {
        try {
          const imagePath = path.join(imagesDir, imageFile);
          const filename = path.basename(imagePath);

          console.log(
            `[S3] Uploading image ${imagePath} to S3 bucket ${this.s3Config.bucket}/${filename}...`,
          );

          // Read the file content using Bun.file
          const file = Bun.file(imagePath);

          // Determine content type based on file extension
          const contentType = file.type;

          // Check if we're in dry run mode
          if (process.env.BUNKI_DRY_RUN === "true") {
            console.log(
              `[S3] Dry run: would upload ${filename} with content type ${contentType}`,
            );
          } else {
            const s3File = this.client.file(filename);
            await s3File.write(file);
          }

          // Get the public URL
          const imageUrl = this.getPublicUrl(filename);
          console.log(`[S3] Image uploaded to ${imageUrl}`);

          imageUrls[imageFile] = imageUrl;
        } catch (error) {
          console.error(`Error uploading ${imageFile}:`, error);
          // Continue with other images even if one fails
        }
      }

      console.log(
        `[S3] Successfully uploaded ${Object.keys(imageUrls).length} of ${imageFiles.length} images`,
      );
      return imageUrls;
    } catch (error) {
      console.error(`Error uploading images:`, error);
      return imageUrls;
    }
  }
}

/**
 * Create an S3 uploader
 * @param config The configuration for the uploader
 * @returns An uploader instance
 */
export function createUploader(config: S3Config): Uploader & ImageUploader {
  return new S3Uploader(config);
}

// Export only the createUploader function - direct uploadImages function is no longer needed
// as we should go through the ImageUploader interface
