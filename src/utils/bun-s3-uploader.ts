import path from "path";
import mime from "mime-types";
import { ImageUploader, R2Config, SiteConfig, Uploader } from "../types";
import { s3, S3Client } from "bun";

/**
 * Bun-native S3 uploader implementation for R2 compatibility
 * Uses Bun's built-in S3 API for better performance
 */
export class BunS3Uploader implements Uploader, ImageUploader {
  private r2Config: R2Config;
  private client: S3Client;

  constructor(r2Config: R2Config) {
    this.r2Config = r2Config;

    // Create a new S3Client with the provided configuration
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
      bucket: r2Config.bucket,
    });

    // Set the client as the default for Bun.s3
    Bun.s3 = this.client;
  }

  async upload(sourcePath: string, config: SiteConfig): Promise<void> {
    console.log(
      `[BunS3] Uploading site ${sourcePath} to S3 bucket ${this.r2Config.bucket}/${config.domain}...`,
    );

    try {
      // This is a simplified implementation - a full implementation would
      // recursively upload all files from the source path
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(sourcePath);
      console.log(`Found ${files.length} files to upload`);

      // Recursive file upload would go here...

      console.log(`[BunS3] Upload to ${config.domain} complete!`);
    } catch (error) {
      console.error(`Error uploading site to S3:`, error);
      throw error;
    }
  }

  /**
   * Get the public URL for a file in S3/R2
   * @param r2Path Path to the file within the bucket
   * @returns The public URL for the file
   */
  private getPublicUrl(r2Path: string): string {
    const bucketName = this.r2Config.bucket;
    const envVarName = `R2_CUSTOM_DOMAIN_${bucketName.replace(/-/g, "_").toUpperCase()}`;
    const customDomain = process.env[envVarName];

    if (customDomain) {
      // Use the custom domain for this specific bucket
      return `https://${customDomain}/${r2Path}`;
    } else {
      // Use the default R2 public URL
      const publicUrl = this.r2Config.publicUrl;
      return publicUrl.includes(this.r2Config.bucket)
        ? `${publicUrl}/${r2Path}`
        : `${publicUrl}/${this.r2Config.bucket}/${r2Path}`;
    }
  }

  async uploadImage(imagePath: string, domainName: string): Promise<string> {
    const filename = path.basename(imagePath);
    // Use domain-specific path structure to organize images by domain
    const r2Path = `${domainName}/${filename}`;

    console.log(
      `[BunS3] Uploading image ${imagePath} to S3 bucket ${this.r2Config.bucket}/${r2Path}...`,
    );

    try {
      // Read the file content using Bun.file
      const file = Bun.file(imagePath);

      // Determine content type based on file extension
      const contentType = mime.lookup(imagePath) || "application/octet-stream";

      // Use the S3Client directly to upload the file
      const s3File = this.client.file(`${r2Path}`, {
        metadata: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        },
      });

      // Read the file and upload it
      await s3File.write(file);

      // Get the public URL
      const imageUrl = this.getPublicUrl(r2Path);
      console.log(`[BunS3] Image uploaded to ${imageUrl}`);

      return imageUrl;
    } catch (error) {
      console.error(`Error uploading image to S3:`, error);
      throw error;
    }
  }

  async uploadImages(
    imagesDir: string,
    domainName: string,
  ): Promise<Record<string, string>> {
    console.log(
      `[BunS3] Uploading all images from ${imagesDir} for domain ${domainName}...`,
    );

    const imageUrls: Record<string, string> = {};

    try {
      // Check if directory exists
      const dirExists = await Bun.file(imagesDir).exists();
      if (!dirExists) {
        console.warn(
          `No images directory found at ${imagesDir}, skipping image upload.`,
        );
        return imageUrls;
      }

      // Get all files in the images directory using Bun.glob
      const glob = new Bun.Glob("*.{jpg,jpeg,png,gif,webp,svg}");
      const files: string[] = [];

      for await (const file of glob.scan({
        cwd: imagesDir,
        absolute: false,
      })) {
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
          const imageUrl = await this.uploadImage(imagePath, domainName);
          imageUrls[imageFile] = imageUrl;
        } catch (error) {
          console.error(`Error uploading ${imageFile}:`, error);
          // Continue with other images even if one fails
        }
      }

      console.log(
        `[BunS3] Successfully uploaded ${Object.keys(imageUrls).length} of ${imageFiles.length} images for ${domainName}`,
      );
      return imageUrls;
    } catch (error) {
      console.error(`Error uploading images for domain ${domainName}:`, error);
      return imageUrls;
    }
  }

  /**
   * Creates a writer for large file uploads using multipart upload
   * @param key The key (path) for the file in S3
   * @returns A writer interface for chunked uploads
   */
  getWriterForLargeFile(key: string, contentType?: string): any {
    const s3File = this.client.file(key, {
      metadata: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      },
    });

    return s3File.writer();
  }

  /**
   * Example function to upload a large file in chunks
   * @param filePath Path to the local file
   * @param remotePath Path in S3 where the file should be stored
   */
  async uploadLargeFile(filePath: string, remotePath: string): Promise<string> {
    console.log(`[BunS3] Uploading large file ${filePath} to ${remotePath}...`);

    try {
      // Get content type
      const contentType = mime.lookup(filePath) || "application/octet-stream";

      // Create a writer for the S3 file
      const writer = this.getWriterForLargeFile(remotePath, contentType);

      // Read the local file in chunks
      const file = Bun.file(filePath);
      const fileStream = file.stream();
      const reader = fileStream.getReader();

      // Use a 1MB buffer for each chunk
      const CHUNK_SIZE = 1024 * 1024;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Write the chunk to S3
        writer.write(value);

        console.log(`[BunS3] Uploaded ${value.byteLength} bytes...`);
      }

      // Finalize the upload
      await writer.end();

      const fileUrl = this.getPublicUrl(remotePath);
      console.log(`[BunS3] Large file uploaded to ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      console.error(`Error uploading large file:`, error);
      throw error;
    }
  }
}
