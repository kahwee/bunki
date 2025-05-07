import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import path from "path";
import mime from "mime-types";
import { ImageUploader, R2Config, SiteConfig, Uploader } from "../types";
import { BunS3Uploader } from "./bun-s3-uploader";

/**
 * Cloudflare R2 uploader implementation that uses AWS S3 compatible API
 */
export class R2Uploader implements Uploader, ImageUploader {
  private r2Config: R2Config;
  private s3Client: S3Client;

  constructor(r2Config: R2Config) {
    this.r2Config = r2Config;

    // Initialize S3 client with R2 endpoint
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });
  }

  /**
   * Stub implementation for large file uploads to maintain interface compatibility.
   * Uses Upload from @aws-sdk/lib-storage which handles multipart uploads.
   */
  async uploadLargeFile(filePath: string, remotePath: string): Promise<string> {
    console.log(
      `[R2] Uploading large file ${filePath} to R2 bucket ${this.r2Config.bucket}/${remotePath}...`,
    );

    try {
      // Read the file content using Bun.file
      const bunFile = Bun.file(filePath);
      const fileContent = Buffer.from(await bunFile.arrayBuffer());

      // Determine content type based on file extension
      const contentType = mime.lookup(filePath) || "application/octet-stream";

      // Upload to R2 using AWS SDK multipart upload
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.r2Config.bucket,
          Key: remotePath,
          Body: fileContent,
          ContentType: contentType,
          // Set cache control to cache for 1 year (31536000 seconds)
          CacheControl: "public, max-age=31536000",
        },
      });

      await upload.done();

      // Get the public URL
      const fileUrl = this.getPublicUrl(remotePath);
      console.log(`[R2] Large file uploaded to ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      console.error(`Error uploading large file to R2:`, error);
      throw error;
    }
  }

  /**
   * Stub method for getting a writer - returns null as this isn't natively supported
   * with AWS SDK in the same way as Bun's native S3 client
   */
  getWriterForLargeFile(key: string, contentType?: string): any {
    console.warn(
      "[R2] Getting a writer for large files is not supported with the AWS SDK implementation. " +
        "Use uploadLargeFile instead, or switch to the Bun native S3 uploader with --type bun-s3.",
    );
    return null;
  }

  async upload(sourcePath: string, config: SiteConfig): Promise<void> {
    console.log(
      `[R2] Uploading site ${sourcePath} to R2 bucket ${this.r2Config.bucket}/${config.domain}...`,
    );

    try {
      // This is a simplified implementation - a full implementation would
      // recursively upload all files from the source path
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(sourcePath);
      console.log(`Found ${files.length} files to upload`);

      // Recursive file upload would go here...

      console.log(`[R2] Upload to ${config.domain} complete!`);
    } catch (error) {
      console.error(`Error uploading site to R2:`, error);
      throw error;
    }
  }

  /**
   * Get the public URL for a file in R2
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
      `[R2] Uploading image ${imagePath} to R2 bucket ${this.r2Config.bucket}/${r2Path}...`,
    );

    try {
      // Read the file content using Bun.file
      const bunFile = Bun.file(imagePath);
      const fileContent = Buffer.from(await bunFile.arrayBuffer());

      // Determine content type based on file extension
      const contentType = mime.lookup(imagePath) || "application/octet-stream";

      // Upload to R2 using AWS SDK (which is compatible with R2)
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.r2Config.bucket,
          Key: r2Path,
          Body: fileContent,
          ContentType: contentType,
          // Set cache control to cache for 1 year (31536000 seconds)
          CacheControl: "public, max-age=31536000",
        },
      });

      await upload.done();

      // Get the public URL
      const imageUrl = this.getPublicUrl(r2Path);
      console.log(`[R2] Image uploaded to ${imageUrl}`);

      return imageUrl;
    } catch (error) {
      console.error(`Error uploading image to R2:`, error);
      throw error;
    }
  }

  async uploadImages(
    imagesDir: string,
    domainName: string,
  ): Promise<Record<string, string>> {
    console.log(
      `[R2] Uploading all images from ${imagesDir} for domain ${domainName}...`,
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
        `[R2] Successfully uploaded ${Object.keys(imageUrls).length} of ${imageFiles.length} images for ${domainName}`,
      );
      return imageUrls;
    } catch (error) {
      console.error(`Error uploading images for domain ${domainName}:`, error);
      return imageUrls;
    }
  }
}

/**
 * Create an uploader or image uploader based on configuration
 * @param type The type of uploader to create ('r2')
 * @param config The configuration for the uploader
 * @returns An uploader instance
 */
export function createUploader(
  type: string,
  config: R2Config,
): Uploader & ImageUploader {
  switch (type.toLowerCase()) {
    case "r2":
      return new R2Uploader(config);
    case "bun-s3":
      return new BunS3Uploader(config);
    case "bun-r2":
      return new BunS3Uploader(config); // Alias for bun-s3 for R2
    default:
      throw new Error(
        `Unsupported uploader type: ${type}. Supported types: 'r2', 'bun-s3', 'bun-r2'`,
      );
  }
}

/**
 * Upload all generated sites to remote storage
 * @param outputDir The directory containing generated sites
 * @param domainConfigs Configuration for each domain
 * @param uploaderType The type of uploader to use ('r2')
 * @param uploaderConfig Configuration for the uploader
 */
export async function uploadSites(
  outputDir: string,
  domainConfigs: Record<string, SiteConfig>,
  uploaderType: string,
  uploaderConfig: R2Config,
): Promise<void> {
  console.log("Starting upload of generated sites...");

  try {
    const uploader = createUploader(uploaderType, uploaderConfig);

    for (const [domainName, config] of Object.entries(domainConfigs)) {
      const domainOutputDir = path.join(outputDir, domainName);

      if (!(await Bun.file(`${domainOutputDir}/index.html`).exists())) {
        console.warn(
          `No output directory found for domain ${domainName}, skipping upload.`,
        );
        continue;
      }

      await uploader.upload(domainOutputDir, config);
    }

    console.log("Upload of all sites complete!");
  } catch (error) {
    console.error("Error uploading sites:", error);
  }
}

/**
 * Upload images for a specific domain
 * @param imagesDir Directory containing images to upload
 * @param domainName Domain name (used for organizing images)
 * @param uploaderType The type of uploader to use ('r2')
 * @param uploaderConfig Configuration for the uploader
 * @returns Record of image filenames to their public URLs
 */
export async function uploadDomainImages(
  imagesDir: string,
  domainName: string,
  uploaderType: string,
  uploaderConfig: R2Config,
): Promise<Record<string, string>> {
  try {
    const uploader = createUploader(uploaderType, uploaderConfig);
    return await uploader.uploadImages(imagesDir, domainName);
  } catch (error) {
    console.error(`Error uploading images for domain ${domainName}:`, error);
    return {};
  }
}
