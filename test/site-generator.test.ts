import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { SiteGenerator } from "../src/site-generator";
import { loadConfig } from "../src/config";
import fs from "fs-extra";
import path from "path";

const FIXTURES_DIR = path.join(import.meta.dir, "../fixtures");
// Use a temporary directory within test/ to ensure it's ignored by git
const OUTPUT_DIR = path.join(import.meta.dir, "test-output");
const CONTENT_DIR = path.join(FIXTURES_DIR, "content");
const TEMPLATES_DIR = path.join(FIXTURES_DIR, "templates");
const CONFIG_PATH = path.join(FIXTURES_DIR, "bunki.config.json");

// Helper to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await fs.pathExists(filePath);
  } catch (error) {
    console.error(`Error checking if file exists:`, error);
    return false;
  }
}

// Helper to count files in a directory recursively
async function countFiles(dir: string): Promise<number> {
  let count = 0;
  
  async function traverse(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else {
        count++;
      }
    }
  }
  
  await traverse(dir);
  return count;
}

describe("SiteGenerator", () => {
  let generator: SiteGenerator;
  
  // Set up the generator before tests
  beforeAll(async () => {
    // Create output directory (ensure it exists)
    await fs.ensureDir(OUTPUT_DIR);
    
    // Load configuration
    const config = loadConfig(CONFIG_PATH);
    
    // Create generator
    generator = new SiteGenerator({
      contentDir: CONTENT_DIR,
      outputDir: OUTPUT_DIR,
      templatesDir: TEMPLATES_DIR,
      config
    });
    
    // Initialize the generator
    await generator.initialize();
  });
  
  // Clean up after tests
  afterAll(async () => {
    // Remove output directory after tests
    await fs.remove(OUTPUT_DIR);
  });
  
  test("should initialize successfully", () => {
    expect(generator).toBeDefined();
    expect(generator['site']).toBeDefined();
    expect(generator['site'].posts).toBeArray();
    expect(generator['site'].tags).toBeObject();
  });
  
  test("should have parsed markdown files correctly", () => {
    // We should have the correct number of posts
    expect(generator['site'].posts.length).toBeGreaterThan(0);
    
    // Check post structure
    const firstPost = generator['site'].posts[0];
    expect(firstPost).toHaveProperty('title');
    expect(firstPost).toHaveProperty('date');
    expect(firstPost).toHaveProperty('content');
    expect(firstPost).toHaveProperty('html');
    expect(firstPost).toHaveProperty('excerpt');
    expect(firstPost).toHaveProperty('tags');
    expect(firstPost.tags).toBeArray();
  });
  
  test("should have parsed tags correctly", () => {
    // We should have tags
    const tags = generator['site'].tags;
    expect(Object.keys(tags).length).toBeGreaterThan(0);
    
    // Check tag structure
    const tagNames = Object.keys(tags);
    const firstTag = tags[tagNames[0]];
    expect(firstTag).toHaveProperty('name');
    expect(firstTag).toHaveProperty('slug');
    expect(firstTag).toHaveProperty('count');
    expect(firstTag).toHaveProperty('posts');
    expect(firstTag.posts).toBeArray();
  });
  
  test("should generate site successfully", async () => {
    // Generate the site
    await generator.generate();
    
    // Check that output directory exists
    expect(await fileExists(OUTPUT_DIR)).toBeTrue();
    
    // Check that index.html exists
    const indexPath = path.join(OUTPUT_DIR, "index.html");
    expect(await fileExists(indexPath)).toBeTrue();
    
    // Check that CSS file exists
    const cssPath = path.join(OUTPUT_DIR, "css", "style.css");
    expect(await fileExists(cssPath)).toBeTrue();
    
    // Check that at least one post page exists
    const postDirExists = await fileExists(path.join(OUTPUT_DIR, "2024"));
    expect(postDirExists).toBeTrue();
    
    // Check that tags directory exists
    const tagsDirExists = await fileExists(path.join(OUTPUT_DIR, "tags"));
    expect(tagsDirExists).toBeTrue();
    
    // Check RSS feed generation
    const feedPath = path.join(OUTPUT_DIR, "feed.xml");
    expect(await fileExists(feedPath)).toBeTrue();
    
    // Check sitemap generation
    const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
    expect(await fileExists(sitemapPath)).toBeTrue();
    
    // Verify we've generated a reasonable number of files
    const fileCount = await countFiles(OUTPUT_DIR);
    expect(fileCount).toBeGreaterThan(10);
  });
});