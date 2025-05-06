import path from 'path';
import fs from 'fs-extra';
import { SiteConfig } from './types';

// Default paths relative to the current working directory
export const DEFAULT_CONTENT_DIR = path.join(process.cwd(), 'content');
export const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'dist');
export const DEFAULT_TEMPLATES_DIR = path.join(process.cwd(), 'templates');
export const DEFAULT_CONFIG_FILE = path.join(process.cwd(), 'bunki.config.json');

/**
 * Check if the configuration file exists
 * @param configPath Path to the configuration file
 * @returns Boolean indicating if the configuration file exists
 */
export function configExists(configPath: string = DEFAULT_CONFIG_FILE): boolean {
  return fs.existsSync(configPath);
}

/**
 * Load configuration from a JSON file
 * @param configPath Path to the configuration file (default: bunki.config.json)
 * @returns Site configuration
 */
export function loadConfig(configPath: string = DEFAULT_CONFIG_FILE): SiteConfig {
  if (fs.existsSync(configPath)) {
    try {
      return fs.readJSONSync(configPath);
    } catch (error) {
      console.error(`Error loading config file ${configPath}:`, error);
      return getDefaultConfig();
    }
  }
  
  return getDefaultConfig();
}

/**
 * Get default config when none is provided
 * @returns Default site configuration
 */
export function getDefaultConfig(): SiteConfig {
  return {
    title: 'My Blog',
    description: 'A blog built with Bunki',
    baseUrl: 'https://example.com',
    domain: 'blog'
  };
}

/**
 * Create a default configuration file if it doesn't exist
 * @param configPath Path to save the configuration file
 * @returns Boolean indicating if the file was created
 */
export function createDefaultConfig(configPath: string = DEFAULT_CONFIG_FILE): boolean {
  if (fs.existsSync(configPath)) {
    console.log(`Config file already exists at ${configPath}`);
    return false;
  }
  
  const defaultConfig: SiteConfig = {
    title: 'My Blog',
    description: 'A blog built with Bunki',
    baseUrl: 'https://example.com',
    domain: 'blog'
  };
  
  try {
    fs.writeJSONSync(configPath, defaultConfig, { spaces: 2 });
    console.log(`Created default config file at ${configPath}`);
    return true;
  } catch (error) {
    console.error(`Error creating default config file:`, error);
    return false;
  }
}

/**
 * Save configuration to a JSON file
 * @param config Configuration object
 * @param configPath Path to save the configuration file
 * @returns Boolean indicating if the file was saved successfully
 */
export function saveConfig(config: SiteConfig, configPath: string = DEFAULT_CONFIG_FILE): boolean {
  try {
    fs.writeJSONSync(configPath, config, { spaces: 2 });
    console.log(`Saved config file to ${configPath}`);
    return true;
  } catch (error) {
    console.error(`Error saving config file:`, error);
    return false;
  }
}