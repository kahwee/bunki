import path from "node:path";
import type { SiteConfig } from "./types";

type ConfigLike = Partial<SiteConfig>;

type ConfigModule = {
  default?: ConfigLike | (() => ConfigLike | Promise<ConfigLike>);
};

export type ProjectPaths = {
  rootDir: string;
  contentDir: string;
  outputDir: string;
  templatesDir: string;
  configFile: string;
};

const ALLOWED_CONFIG_EXTS = [".ts", ".js", ".mjs", ".cjs", ".json"] as const;

export function createProjectPaths(rootDir: string = process.cwd()): ProjectPaths {
  const root = path.resolve(rootDir);
  return {
    rootDir: root,
    contentDir: path.join(root, "content"),
    outputDir: path.join(root, "dist"),
    templatesDir: path.join(root, "templates"),
    configFile: path.join(root, "bunki.config.ts"),
  };
}

const initialPaths = createProjectPaths();
export const DEFAULT_CONTENT_DIR = initialPaths.contentDir;
export const DEFAULT_OUTPUT_DIR = initialPaths.outputDir;
export const DEFAULT_TEMPLATES_DIR = initialPaths.templatesDir;
export const DEFAULT_CONFIG_TS = initialPaths.configFile;
export const DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_TS;

function isSafeConfigPath(configPath: string, projectRoot: string): boolean {
  try {
    const normalized = path.resolve(configPath);
    const root = path.resolve(projectRoot);
    const relative = path.relative(root, normalized);

    if (
      !ALLOWED_CONFIG_EXTS.includes(
        path.extname(normalized) as (typeof ALLOWED_CONFIG_EXTS)[number],
      )
    ) {
      return false;
    }
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return false;
    }
    if (/[\\/]\.{2}(?:[\\/]|$)/.test(configPath) || /%2f/i.test(configPath)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function defineConfig<T extends ConfigLike | (() => ConfigLike | Promise<ConfigLike>)>(
  config: T,
): T {
  return config;
}

export async function configExists(
  configPath: string = createProjectPaths().configFile,
): Promise<boolean> {
  return Bun.file(configPath).exists();
}

export async function loadConfig(
  configPath: string = createProjectPaths().configFile,
  projectRoot: string = process.cwd(),
): Promise<SiteConfig> {
  const root = path.resolve(projectRoot);
  const resolved = path.isAbsolute(configPath)
    ? path.resolve(configPath)
    : path.resolve(root, configPath);

  if (!isSafeConfigPath(resolved, root)) {
    throw new Error("Unsafe config path: must be within project directory");
  }

  if (!(await Bun.file(resolved).exists())) {
    return getDefaultConfig();
  }

  try {
    const imported: ConfigModule = await import(resolved);
    let cfg = imported.default;
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
  return {
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
}

export async function createDefaultConfig(
  configPath: string = createProjectPaths().configFile,
): Promise<boolean> {
  if (await configExists(configPath)) {
    console.log("Config file already exists");
    return false;
  }

  try {
    // Bun loads .env files automatically, so generated projects need no dotenv dependency.
    const tsContent = `import { defineConfig } from "bunki";

export default defineConfig({
  title: "My Blog",
  description: "A blog built with Bunki",
  baseUrl: "https://example.com",
  domain: "blog",
  publicUrl: process.env.S3_PUBLIC_URL,
  s3: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    bucket: process.env.S3_BUCKET || "",
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
  },
});
`;
    await Bun.write(configPath, tsContent);
    console.log(`Created default config file at ${configPath}`);
    return true;
  } catch (error) {
    console.error("Error creating default config file:", error);
    return false;
  }
}

export async function saveConfig(
  config: SiteConfig,
  configPath: string = createProjectPaths().configFile,
): Promise<boolean> {
  try {
    const tsContent = `import { defineConfig } from "bunki";

export default defineConfig(${JSON.stringify(config, null, 2)});
`;
    await Bun.write(configPath, tsContent);
    console.log(`Saved config file to ${configPath}`);
    return true;
  } catch (error) {
    console.error("Error saving config file:", error);
    return false;
  }
}
