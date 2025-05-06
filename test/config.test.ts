import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { 
  loadConfig, 
  createDefaultConfig, 
  configExists,
  getDefaultConfig
} from "../src/config";
import fs from "fs-extra";
import path from "path";

const TEST_CONFIG_PATH = path.join(import.meta.dir, "temp-config.json");

describe("Configuration", () => {
  // Clean up before tests
  beforeAll(async () => {
    if (await fs.pathExists(TEST_CONFIG_PATH)) {
      await fs.remove(TEST_CONFIG_PATH);
    }
  });
  
  // Clean up after tests
  afterAll(async () => {
    // Always clean up the test config file
    if (await fs.pathExists(TEST_CONFIG_PATH)) {
      await fs.remove(TEST_CONFIG_PATH);
    }
  });
  
  test("loadConfig should use default config when file doesn't exist", () => {
    const nonExistentPath = path.join(import.meta.dir, "non-existent-config.json");
    const config = loadConfig(nonExistentPath);
    
    expect(config).toHaveProperty("title");
    expect(config).toHaveProperty("description");
    expect(config).toHaveProperty("baseUrl");
    expect(config).toHaveProperty("domain");
  });
  
  test("createDefaultConfig should create a config file", async () => {
    const created = createDefaultConfig(TEST_CONFIG_PATH);
    
    expect(created).toBeTrue();
    expect(await fs.pathExists(TEST_CONFIG_PATH)).toBeTrue();
    
    const fileContent = await fs.readFile(TEST_CONFIG_PATH, "utf-8");
    const parsedConfig = JSON.parse(fileContent);
    
    expect(parsedConfig).toHaveProperty("title");
    expect(parsedConfig).toHaveProperty("description");
    expect(parsedConfig).toHaveProperty("baseUrl");
    expect(parsedConfig).toHaveProperty("domain");
  });
  
  test("createDefaultConfig should not overwrite existing config", async () => {
    // Create a custom config
    const customConfig = {
      title: "Custom Title",
      description: "Custom Description",
      baseUrl: "https://custom.example.com",
      domain: "custom.example.com"
    };
    
    await fs.writeJSON(TEST_CONFIG_PATH, customConfig);
    
    // Try to create default config at same path
    const created = createDefaultConfig(TEST_CONFIG_PATH);
    
    expect(created).toBeFalse();
    
    // Verify file wasn't changed
    const fileContent = await fs.readFile(TEST_CONFIG_PATH, "utf-8");
    const parsedConfig = JSON.parse(fileContent);
    
    expect(parsedConfig.title).toBe("Custom Title");
    expect(parsedConfig.description).toBe("Custom Description");
  });
  
  test("configExists should correctly detect config file", async () => {
    expect(await configExists(TEST_CONFIG_PATH)).toBeTrue();
    
    const nonExistentPath = path.join(import.meta.dir, "non-existent-config.json");
    expect(await configExists(nonExistentPath)).toBeFalse();
  });
  
  test("getDefaultConfig should return default values", () => {
    const config = getDefaultConfig();
    
    expect(config.title).toBeDefined();
    expect(config.description).toBeDefined();
    expect(config.baseUrl).toBeDefined();
    expect(config.domain).toBeDefined();
  });
});