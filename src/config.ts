import path from "path";
import { SiteConfig } from "./types";

export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content");
export const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "dist");
export const DEFAULT_TEMPLATES_DIR = path.join(process.cwd(), "templates");
export const DEFAULT_CONFIG_FILE = path.join(
  process.cwd(),
  "bunki.config.json",
);

export function configExists(
  configPath: string = DEFAULT_CONFIG_FILE,
): boolean {
  return Bun.file(configPath).size > 0;
}

export async function loadConfig(
  configPath: string = DEFAULT_CONFIG_FILE,
): Promise<SiteConfig> {
  const configFile = Bun.file(configPath);
  if (await configFile.exists()) {
    try {
      const configText = await configFile.text();
      return JSON.parse(configText);
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
  const configFile = Bun.file(configPath);
  if (await configFile.exists()) {
    console.log(`Config file already exists at ${configPath}`);
    return false;
  }

  const defaultConfig: SiteConfig = {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "blog",
  };

  try {
    await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2));
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
    await Bun.write(configPath, JSON.stringify(config, null, 2));
    console.log(`Saved config file to ${configPath}`);
    return true;
  } catch (error) {
    console.error(`Error saving config file:`, error);
    return false;
  }
}
