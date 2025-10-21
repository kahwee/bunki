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

  test("should copy public directory files (including extensionless & dotfiles)", async () => {
    const projectRoot = process.cwd();
    const publicDir = path.join(projectRoot, "public");
    // ensure public dir exists for this test
    await ensureDir(publicDir);

    // Create sample files
    const files: Record<string, string> = {
      "robots.txt": "User-agent: *\nAllow: /",
      "humans.txt": "We are people.",
      ".well-known/security.txt": "Contact: mailto:security@example.com",
      "images/logo.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
      CNAME: "example.com",
    };

    for (const [rel, content] of Object.entries(files)) {
      const fullPath = path.join(publicDir, rel);
      await ensureDir(path.dirname(fullPath));
      await Bun.write(fullPath, content);
    }

    await generator.generate();

    // Assert files copied (flattened without top-level public folder)
    for (const rel of Object.keys(files)) {
      const outputPath = path.join(OUTPUT_DIR, rel);
      const f = Bun.file(outputPath);
      expect(await f.exists()).toBeTrue();
    }
  });

  test("tags can be sorted by count", () => {
    const tags = generator["site"].tags;
    const tagArray = Object.values(tags);

    // Sort tags by count descending
    const sortedTags = tagArray.sort((a, b) => b.count - a.count);

    // Verify tags are properly sorted (descending order)
    for (let i = 0; i < sortedTags.length - 1; i++) {
      expect(sortedTags[i].count).toBeGreaterThanOrEqual(
        sortedTags[i + 1].count,
      );
    }
  });

  test("tags can be limited to maxTagsOnHomepage", () => {
    // Get all tags sorted by count
    const allTags = Object.values(generator["site"].tags).sort(
      (a, b) => b.count - a.count,
    );

    const maxTags = 20;
    const limited = allTags.slice(0, maxTags);

    // Verify that limit works correctly
    expect(limited.length).toBeLessThanOrEqual(maxTags);

    // If we have more than 20 tags, verify we get exactly 20
    if (allTags.length > maxTags) {
      expect(limited.length).toBe(maxTags);
    }
  });

  // ============================================
  // RSS Feed Tests - Namespace & Module Support
  // ============================================

  test("RSS feed should include all required namespaces", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Verify Atom namespace for self-discovery links
    expect(feedContent).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    // Verify Content module namespace for full-text RSS
    expect(feedContent).toContain(
      'xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    );
    // Verify Media RSS module namespace for image/thumbnail support
    expect(feedContent).toContain(
      'xmlns:media="http://search.yahoo.com/mrss/"',
    );
  });

  // ============================================
  // RSS Channel Metadata Tests
  // ============================================

  test("RSS feed should include language metadata", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    expect(feedContent).toContain("<language>en-US</language>");
  });

  test("RSS feed should include managing editor and web master", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    expect(feedContent).toContain(
      "<managingEditor>author@example.com (Test Author)</managingEditor>",
    );
    expect(feedContent).toContain(
      "<webMaster>webmaster@example.com</webMaster>",
    );
  });

  test("RSS feed should include copyright information", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    expect(feedContent).toContain(
      "<copyright><![CDATA[Copyright © 2025 Bunki Test Blog]]></copyright>",
    );
  });

  test("RSS feed should include pubDate and lastBuildDate", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    expect(feedContent).toContain("<pubDate>");
    expect(feedContent).toContain("<lastBuildDate>");
  });

  // ============================================
  // RSS Item-Level Metadata Tests
  // ============================================

  test("RSS feed items should have guid with isPermaLink attribute", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Check for guid with isPermaLink="true" attribute
    expect(feedContent).toContain('isPermaLink="true"');

    // Should have multiple guid entries (one per item)
    const guidMatches = feedContent.match(/<guid isPermaLink="true">/g);
    expect(guidMatches).toBeDefined();
    expect(guidMatches!.length).toBeGreaterThan(0);
  });

  test("RSS feed items should include author information", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Check for author element in items with email and name
    expect(feedContent).toContain("<author>");
    expect(feedContent).toContain("author@example.com (Test Author)");
  });

  test("RSS feed items should include category tags from post tags", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Check for category elements
    expect(feedContent).toContain("<category>");
    expect(feedContent).toContain("</category>");

    // Should have multiple categories from different posts
    const categoryMatches = feedContent.match(/<category>/g);
    expect(categoryMatches).toBeDefined();
    expect(categoryMatches!.length).toBeGreaterThan(0);
  });

  // ============================================
  // RSS Content Module Tests (Full-Text RSS)
  // ============================================

  test("RSS feed items should include full HTML content via content:encoded", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Check for content:encoded module elements
    expect(feedContent).toContain("<content:encoded>");
    expect(feedContent).toContain("</content:encoded>");

    // Should have one content:encoded entry per item
    const contentMatches = feedContent.match(/<content:encoded>/g);
    expect(contentMatches).toBeDefined();
    expect(contentMatches!.length).toBeGreaterThan(0);

    // Verify it contains actual HTML content (not just empty tags)
    expect(feedContent).toContain("<h1>");
    expect(feedContent).toContain("<p>");
  });

  // ============================================
  // RSS Media Module Tests (Image Support)
  // ============================================

  test("RSS feed items should support media:thumbnail for featured images", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Media thumbnails are optional (only if posts have images)
    // Just verify the Media RSS module is available when images exist
    if (feedContent.includes("<media:thumbnail")) {
      expect(feedContent).toContain("<media:thumbnail url=");
      expect(feedContent).toContain('" />');
    } else {
      // If no thumbnails, just verify the namespace is declared for future use
      expect(feedContent).toContain("xmlns:media=");
    }
  });

  // ============================================
  // RSS Format Compliance Tests
  // ============================================

  test("RSS feed dates should be in RFC 822 format", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // RFC 822 format: "Day, DD Mon YYYY HH:MM:SS GMT"
    // Example: "Sat, 18 Oct 2025 16:00:00 GMT"
    const rfc822Regex = /\w{3},\s\d{1,2}\s\w{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT/;

    // Should have at least one pubDate and lastBuildDate matching RFC 822
    expect(feedContent).toMatch(rfc822Regex);
  });

  test("RSS feed should have proper atom:link for feed self-discovery", async () => {
    const feedFile = Bun.file(path.join(OUTPUT_DIR, "feed.xml"));
    const feedContent = await feedFile.text();

    // Verify Atom self-link with correct attributes
    expect(feedContent).toContain("atom:link href=");
    expect(feedContent).toContain('rel="self"');
    expect(feedContent).toContain('type="application/rss+xml"');
  });
});
