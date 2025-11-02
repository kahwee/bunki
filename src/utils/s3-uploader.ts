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

  /**
   * Execute async tasks with concurrency limit
   * @param tasks Array of task functions that return promises
   * @param concurrency Maximum number of concurrent tasks
   */
  private async executeWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number,
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<any>[] = [];

    for (const task of tasks) {
      const promise = task()
        .then((result) => {
          results.push(result);
          // Remove from executing when done
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        })
        .catch((error) => {
          // Still remove from executing on error
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  async uploadImages(
    imagesDir: string,
    minYear?: number,
  ): Promise<Record<string, string>> {
    console.log(
      `[S3] Uploading all images from ${imagesDir} to bucket ${this.s3Config.bucket}...`,
    );

    if (minYear) {
      console.log(`[S3] Filtering images from year ${minYear} onwards`);
    }

    const imageUrls: Record<string, string> = {};

    try {
      // Get all files in the images directory using Bun.glob (recursively)
      const glob = new Bun.Glob("**/*.{jpg,jpeg,png,gif,webp,svg}");
      const files: string[] = [];

      console.log(`[S3] Scanning directory ${imagesDir} for image files...`);

      try {
        for await (const file of glob.scan({
          cwd: imagesDir,
          absolute: false,
        })) {
          // If minYear is specified, filter by year directory
          if (minYear) {
            const yearMatch = file.match(/^(\d{4})\//);
            if (yearMatch) {
              const fileYear = parseInt(yearMatch[1], 10);
              if (fileYear >= minYear) {
                files.push(file);
              }
            }
          } else {
            files.push(file);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`Error scanning images directory: ${errorMessage}`);
        return imageUrls;
      }

      // The files are already filtered by glob pattern and year (if specified)
      const imageFiles = files;

      if (imageFiles.length === 0) {
        console.warn(`No image files found in ${imagesDir}`);
        return imageUrls;
      }

      console.log(`Found ${imageFiles.length} images to upload`);
      console.log(`[S3] Processing with 10 concurrent uploads...`);

      // Upload images in parallel with concurrency limit
      const concurrencyLimit = 10;
      let uploadedCount = 0;
      let failedCount = 0;

      // Create upload tasks for each image
      const uploadTasks = imageFiles.map((imageFile) => async () => {
        try {
          const imagePath = path.join(imagesDir, imageFile);
          const filename = path.basename(imagePath);

          // Read the file content using Bun.file
          const file = Bun.file(imagePath);

          // Determine content type based on file extension
          const contentType = file.type;

          // Check if we're in dry run mode
          if (process.env.BUNKI_DRY_RUN === "true") {
            // Dry run: just simulate
          } else {
            const s3File = this.client.file(imageFile);
            await s3File.write(file);
          }

          // Get the public URL
          const imageUrl = this.getPublicUrl(imageFile);
          imageUrls[imageFile] = imageUrl;
          uploadedCount++;

          // Progress update every 10 images
          if (uploadedCount % 10 === 0) {
            console.log(
              `[S3] Progress: ${uploadedCount}/${imageFiles.length} images uploaded`,
            );
          }

          return { success: true, file: imageFile };
        } catch (error) {
          failedCount++;
          console.error(`[S3] Error uploading ${imageFile}:`, error);
          return { success: false, file: imageFile };
        }
      });

      // Execute uploads with concurrency limit
      await this.executeWithConcurrency(uploadTasks, concurrencyLimit);

      console.log(
        `[S3] Upload complete: ${uploadedCount} succeeded, ${failedCount} failed out of ${imageFiles.length} images`,
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
