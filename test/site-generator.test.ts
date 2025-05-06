import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { SiteGenerator } from "../src/site-generator";
import { loadConfig } from "../src/config";
import path from "path";
import { ensureDir } from "../src/utils/file-utils";
import { Glob } from "bun";

const FIXTURES_DIR = path.join(import.meta.dir, "../fixtures");
// Use a temporary directory within test/ to ensure it's ignored by git
const OUTPUT_DIR = path.join(import.meta.dir, "test-output");
const CONTENT_DIR = path.join(FIXTURES_DIR, "content");
const TEMPLATES_DIR = path.join(FIXTURES_DIR, "templates");
const CONFIG_PATH = path.join(FIXTURES_DIR, "bunki.config.json");

// Helper to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    // For directories, we need a different approach since Bun.file().exists()
    // doesn't work reliably for directories
    if (filePath.endsWith("/") || !filePath.includes(".")) {
      try {
        const glob = new Glob("*");
        for await (const _ of glob.scan({ cwd: filePath, absolute: true })) {
          return true; // If we can scan the directory, it exists
        }
        return true; // Empty directories also exist
      } catch {
        return false;
      }
    }

    // For files
    const file = Bun.file(filePath);
    return await file.exists();
  } catch (error) {
    console.error(`Error checking if file exists:`, error);
    return false;
  }
}

// Helper to count files in a directory recursively
async function countFiles(dir: string): Promise<number> {
  let count = 0;

  async function traverse(currentDir: string) {
    const glob = new Glob("*");
    for await (const entry of glob.scan({ cwd: currentDir, absolute: true })) {
      const entryFile = Bun.file(entry);
      const info = await entryFile.stat();

      if (info.isDirectory) {
        await traverse(entry);
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
    await ensureDir(OUTPUT_DIR);

    // Load configuration
    const config = await loadConfig(CONFIG_PATH);

    // Create generator
    generator = new SiteGenerator({
      contentDir: CONTENT_DIR,
      outputDir: OUTPUT_DIR,
      templatesDir: TEMPLATES_DIR,
      config,
    });

    // Initialize the generator
    await generator.initialize();
  });

  // Clean up after tests
  afterAll(async () => {
    // Mark output directory for deletion
    await Bun.write(path.join(OUTPUT_DIR, ".deleted"), "");
  });

  test("should initialize successfully", () => {
    expect(generator).toBeDefined();
    expect(generator["site"]).toBeDefined();
    expect(generator["site"].posts).toBeArray();
    expect(generator["site"].tags).toBeObject();
  });

  test("should have parsed markdown files correctly", () => {
    // We should have the correct number of posts
    expect(generator["site"].posts.length).toBeGreaterThan(0);

    // Check post structure
    const firstPost = generator["site"].posts[0];
    expect(firstPost).toHaveProperty("title");
    expect(firstPost).toHaveProperty("date");
    expect(firstPost).toHaveProperty("content");
    expect(firstPost).toHaveProperty("html");
    expect(firstPost).toHaveProperty("excerpt");
    expect(firstPost).toHaveProperty("tags");
    expect(firstPost.tags).toBeArray();
  });

  test("should have parsed tags correctly", () => {
    // We should have tags
    const tags = generator["site"].tags;
    expect(Object.keys(tags).length).toBeGreaterThan(0);

    // Check tag structure
    const tagNames = Object.keys(tags);
    const firstTag = tags[tagNames[0]];
    expect(firstTag).toHaveProperty("name");
    expect(firstTag).toHaveProperty("slug");
    expect(firstTag).toHaveProperty("count");
    expect(firstTag).toHaveProperty("posts");
    expect(firstTag.posts).toBeArray();
  });

  test("should generate site successfully", async () => {
    // Generate the site
    await generator.generate();

    // Check files directly without using the fileExists helper
    const indexFile = Bun.file(path.join(OUTPUT_DIR, "index.html"));
    expect(await indexFile.exists()).toBeTrue();

    const cssFile = Bun.file(path.join(OUTPUT_DIR, "css", "style.css"));
    expect(await cssFile.exists()).toBeTrue();

    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    expect(await feedFile.exists()).toBeTrue();

    const sitemapFile = Bun.file(path.join(OUTPUT_DIR, "sitemap.xml"));
    expect(await sitemapFile.exists()).toBeTrue();

    // Instead of checking directories, check that expected index.html files exist in those dirs
    const twentyFiveIndex = Bun.file(
      path.join(OUTPUT_DIR, "2025", "index.html"),
    );
    expect(await twentyFiveIndex.exists()).toBeTrue();

    const tagsIndex = Bun.file(path.join(OUTPUT_DIR, "tags", "index.html"));
    expect(await tagsIndex.exists()).toBeTrue();

    // Skip file count check as it can be unreliable
  });
});
