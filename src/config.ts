import path from "path";
import { SiteConfig } from "./types";

export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content");
export const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "dist");
export const DEFAULT_TEMPLATES_DIR = path.join(process.cwd(), "templates");
export const DEFAULT_CONFIG_TS = path.join(process.cwd(), "bunki.config.ts");
export const DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_TS;

export async function configExists(
  configPath: string = DEFAULT_CONFIG_FILE,
): Promise<boolean> {
  return await Bun.file(configPath).exists();
}

export async function loadConfig(
  configPath: string = DEFAULT_CONFIG_FILE,
): Promise<SiteConfig> {
  const configFile = Bun.file(configPath);
  if (await configFile.exists()) {
    try {
      // TypeScript config file
      const config = await import(configPath);
      // If it's a function, execute it to get the config
      if (typeof config.default === "function") {
        return await config.default();
      }
      // Otherwise, return the default export as config
      return config.default || getDefaultConfig();
    } catch (error) {
      console.error(`Error loading config file ${configPath}:`, error);
      return getDefaultConfig();
    }
  }

  return getDefaultConfig();
}

export function getDefaultConfig(): SiteConfig {
  return {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "blog",
  };
}

export async function createDefaultConfig(
  configPath: string = DEFAULT_CONFIG_FILE,
): Promise<boolean> {
  // Check if config file already exists
  if (await configExists()) {
    console.log(`Config file already exists`);
    return false;
  }

  try {
    // Create TypeScript config file
    const tsContent = `import { SiteConfig } from "bunki";
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
}`;
    await Bun.write(configPath, tsContent);

    console.log(`Created default config file at ${configPath}`);
    return true;
  } catch (error) {
    console.error(`Error creating default config file:`, error);
    return false;
  }
}

export async function saveConfig(
  config: SiteConfig,
  configPath: string = DEFAULT_CONFIG_FILE,
): Promise<boolean> {
  try {
    // Generate TypeScript configuration file
    const tsContent = `import { SiteConfig } from "bunki";

export default function(): SiteConfig {
  return ${JSON.stringify(config, null, 2)};
}`;
    await Bun.write(configPath, tsContent);
    console.log(`Saved config file to ${configPath}`);
    return true;
  } catch (error) {
    console.error(`Error saving config file:`, error);
    return false;
  }
}
