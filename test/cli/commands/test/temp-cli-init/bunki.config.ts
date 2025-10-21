import { SiteConfig } from "bunki";
import { config } from "dotenv";

// Load environment variables from .env file
config();

// TypeScript configuration with environment variables support
export default function(): SiteConfig {
  return {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "blog",
    // S3 upload configuration
    publicUrl: process.env.S3_PUBLIC_URL, // Public URL prefix for images
    s3: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      bucket: process.env.S3_BUCKET || "", // Defaults to domain name with dots replaced by hyphens if not set
      endpoint: process.env.S3_ENDPOINT,   // Custom endpoint for S3 service (optional)
      region: process.env.S3_REGION || "auto"
    }
  };
}