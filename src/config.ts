import path from "node:path";
import type { SiteConfig } from "./types";

type ConfigLike = Partial<SiteConfig>;

type ConfigModule = {
  default?: ConfigLike | (() => ConfigLike | Promise<ConfigLike>);
};

const PROJECT_ROOT = process.cwd();
const ALLOWED_CONFIG_EXTS = [".ts", ".js", ".mjs", ".cjs", ".json"]; // keep tight

function isSafeConfigPath(p: string): boolean {
  try {
    const normalized = path.resolve(p);
    if (!ALLOWED_CONFIG_EXTS.includes(path.extname(normalized))) return false;
    if (!normalized.startsWith(PROJECT_ROOT)) return false; // outside project root
    // basic traversal pattern rejection
    if (/[\\/]\.{2}(?:[\\/]|$)/.test(p) || /%2f/i.test(p)) return false;
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content");
export const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "dist");
export const DEFAULT_TEMPLATES_DIR = path.join(process.cwd(), "templates");
export const DEFAULT_CONFIG_TS = path.join(process.cwd(), "bunki.config.ts");
export const DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_TS;

export async function configExists(configPath: string = DEFAULT_CONFIG_FILE): Promise<boolean> {
  return await Bun.file(configPath).exists();
}

export async function loadConfig(configPath: string = DEFAULT_CONFIG_FILE): Promise<SiteConfig> {
  // Normalize relative path to project root
  const resolved = path.isAbsolute(configPath) ? configPath : path.join(PROJECT_ROOT, configPath);

  if (!isSafeConfigPath(resolved)) {
    throw new Error("Unsafe config path: must be within project directory");
  }

  const exists = await Bun.file(resolved).exists();
  if (!exists) {
    return getDefaultConfig();
  }

  try {
    const imported: ConfigModule = await import(resolved);
    let cfg: ConfigLike | (() => ConfigLike | Promise<ConfigLike>) | undefined = imported.default;
    if (typeof cfg === "function") {
      cfg = await cfg();
    }
    if (!cfg || typeof cfg !== "object") {
      return getDefaultConfig();
    }

    return {
      ...cfg,
      title: cfg.title ?? "My Blog",
      description: cfg.description ?? "A blog built with Bunki",
      baseUrl: cfg.baseUrl ?? "https://example.com",
      domain: cfg.domain ?? "blog",
      site: cfg.site ?? {
        title: cfg.title ?? "My Blog",
        description: cfg.description ?? "A blog built with Bunki",
        url: cfg.baseUrl ?? "https://example.com",
        author: typeof cfg.author === "string" ? cfg.author : "",
      },
    };
  } catch (error) {
    console.error(`Error loading config file ${resolved}:`, error);
    return getDefaultConfig();
  }
}

export function getDefaultConfig(): SiteConfig {
  const base: SiteConfig = {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "blog",
    site: {
      title: "My Blog",
      description: "A blog built with Bunki",
      url: "https://example.com",
      author: "",
    },
  };
  return base;
}

export async function createDefaultConfig(
  configPath: string = DEFAULT_CONFIG_FILE,
): Promise<boolean> {
  // Check if config file already exists
  if (await configExists(configPath)) {
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
      bucket: process.env.S3_BUCKET || "",
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
