import path from "path";
import { ImageUploadOptions, InitImagesOptions, R2Config } from "../types";
import { loadConfig } from "../config";
import { uploadDomainImages } from "./uploader";
import { ensureDir, fileExists } from "./file-utils";

// Constants
export const DEFAULT_IMAGES_DIR = path.join(process.cwd(), "images");

// Helper function to load uploader configuration
export function getUploaderConfig(uploadType: string): R2Config {
  let uploadConfig: R2Config = {
    accountId: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    publicUrl: "",
  };

  if (uploadType === "r2") {
    uploadConfig = {
      accountId: process.env.R2_ACCOUNT_ID || "",
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      bucket: process.env.R2_BUCKET || "", // Will be overridden by domain-specific bucket
      publicUrl: process.env.R2_PUBLIC_URL || "",
    };

    // Validate R2 config
    if (
      !uploadConfig.accountId ||
      !uploadConfig.accessKeyId ||
      !uploadConfig.secretAccessKey ||
      !uploadConfig.publicUrl
    ) {
      console.error("Missing R2 configuration. Please check your .env file.");
      process.exit(1);
    }
  } else {
    console.error(`Unsupported upload type: ${uploadType}`);
    process.exit(1);
  }

  return uploadConfig;
}

// Upload images implementation function (reusable)
export async function uploadImages(
  options: ImageUploadOptions = {},
): Promise<Record<string, string>> {
  try {
    // If domain is not provided, get it from bunki config
    let domain = options.domain;
    if (!domain) {
      const config = await loadConfig();
      domain = config.domain;
    }

    if (!domain) {
      console.error(
        "Error: domain is required. Use --domain <domainName> or ensure domain is in bunki.config.json",
      );
      process.exit(1);
    }

    const imagesDir = path.resolve(options.images || DEFAULT_IMAGES_DIR);
    const domainImagesDir = path.join(imagesDir, domain);

    // Check if domain-specific images directory exists
    if (!(await fileExists(domainImagesDir))) {
      // Create domain-specific directory if not exists
      console.log(`Creating images directory for ${domain}...`);
      await ensureDir(domainImagesDir);
    }

    console.log(
      `Uploading images for domain ${domain} from ${domainImagesDir}`,
    );

    const uploadType = options.type || "r2";
    const uploadConfig = getUploaderConfig(uploadType);

    // Convert domain name to bucket name format (e.g., example.com -> example-com)
    const bucketName = domain.replace(/\./g, "-");
    uploadConfig.bucket = bucketName;

    // Upload images
    const imageUrlMap = await uploadDomainImages(
      domainImagesDir,
      domain,
      uploadType,
      uploadConfig,
    );

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

// Initialize image directories implementation function (reusable)
export async function initImages(
  options: InitImagesOptions = {},
): Promise<void> {
  try {
    const imagesDir = path.resolve(options.images || DEFAULT_IMAGES_DIR);

    // Create main images directory if not exists
    if (!(await fileExists(imagesDir))) {
      console.log(`Creating main images directory at ${imagesDir}...`);
      await ensureDir(imagesDir);
    }

    // Create images directory for the configured domain
    const config = await loadConfig();
    const domainImagesDir = path.join(imagesDir, config.domain);
    if (!(await fileExists(domainImagesDir))) {
      console.log(`Creating images directory for ${config.domain}...`);
      // Create directory and .gitkeep to ensure it's tracked in git
      await ensureDir(domainImagesDir);
    }

    console.log("\nImage directory structure initialized successfully!");
    console.log("\nPlace your images in domain-specific folders and use:");
    console.log("bunki upload-images");
  } catch (error) {
    console.error("Error initializing image directories:", error);
    process.exit(1);
  }
}
