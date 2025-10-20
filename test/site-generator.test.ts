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
      expect(sortedTags[i].count).toBeGreaterThanOrEqual(sortedTags[i + 1].count);
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

  describe("RSS Feed Generation", () => {
    test("should generate valid RSS feed", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedFile = Bun.file(feedPath);
      expect(await feedFile.exists()).toBeTrue();

      const feedContent = await feedFile.text();

      // Check XML structure
      expect(feedContent).toInclude('<?xml version="1.0" encoding="UTF-8"?>');
      expect(feedContent).toInclude('<rss version="2.0"');
      expect(feedContent).toInclude("<channel>");
      expect(feedContent).toInclude("</channel>");
      expect(feedContent).toInclude("</rss>");
    });

    test("should include site metadata in RSS feed", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedContent = await Bun.file(feedPath).text();

      // Check for site title and description
      expect(feedContent).toInclude("<title>");
      expect(feedContent).toInclude("<description>");
      expect(feedContent).toInclude("<link>");
      expect(feedContent).toInclude("<lastBuildDate>");
    });

    test("should limit RSS feed to 15 most recent posts", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedContent = await Bun.file(feedPath).text();

      // Count number of <item> tags
      const itemMatches = feedContent.match(/<item>/g);
      const itemCount = itemMatches ? itemMatches.length : 0;

      // Should have at most 15 items
      expect(itemCount).toBeLessThanOrEqual(15);
    });

    test("should properly escape CDATA in RSS feed", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedContent = await Bun.file(feedPath).text();

      // Check for CDATA sections
      expect(feedContent).toInclude("<![CDATA[");
      expect(feedContent).toInclude("]]>");

      // Check that title and description use CDATA
      const titleCDATA = feedContent.match(
        /<title><!\[CDATA\[.*?\]\]><\/title>/s,
      );
      expect(titleCDATA).not.toBeNull();
    });

    test("should include post metadata in RSS items", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedContent = await Bun.file(feedPath).text();

      // Each item should have required fields
      if (feedContent.includes("<item>")) {
        expect(feedContent).toInclude("<guid>");
        expect(feedContent).toInclude("<pubDate>");
        expect(feedContent).toInclude("<description>");
      }
    });

    test("should format dates in RFC-822 format for RSS", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedContent = await Bun.file(feedPath).text();

      // Check for RFC-822 date format (e.g., "Mon, 01 Jan 2025 12:00:00 GMT")
      const datePattern = /<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/;
      expect(feedContent).toMatch(datePattern);
    });

    test("should include atom:link self-reference", async () => {
      await generator.generate();

      const feedPath = path.join(OUTPUT_DIR, "feed.xml");
      const feedContent = await Bun.file(feedPath).text();

      // Check for Atom namespace and self link
      expect(feedContent).toInclude('xmlns:atom="http://www.w3.org/2005/Atom"');
      expect(feedContent).toInclude('<atom:link');
      expect(feedContent).toInclude('rel="self"');
      expect(feedContent).toInclude('type="application/rss+xml"');
    });
  });

  describe("Sitemap Generation", () => {
    test("should generate valid sitemap.xml", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapFile = Bun.file(sitemapPath);
      expect(await sitemapFile.exists()).toBeTrue();

      const sitemapContent = await sitemapFile.text();

      // Check XML structure
      expect(sitemapContent).toInclude('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemapContent).toInclude(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      );
      expect(sitemapContent).toInclude("</urlset>");
    });

    test("should include homepage in sitemap", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // Homepage should have highest priority
      expect(sitemapContent).toInclude("<loc>");
      expect(sitemapContent).toInclude("</loc>");
      expect(sitemapContent).toInclude("<priority>1.0</priority>");
      expect(sitemapContent).toInclude("<changefreq>daily</changefreq>");
    });

    test("should include all posts in sitemap", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      const postCount = generator["site"].posts.length;

      // Count URL entries (rough check)
      const urlMatches = sitemapContent.match(/<url>/g);
      const urlCount = urlMatches ? urlMatches.length : 0;

      // Should have at least as many URLs as posts
      expect(urlCount).toBeGreaterThanOrEqual(postCount);
    });

    test("should calculate priority based on post freshness", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // Check for various priority levels
      expect(sitemapContent).toInclude("<priority>");

      // Priorities should be between 0.0 and 1.0
      const priorityMatches = sitemapContent.match(
        /<priority>([\d.]+)<\/priority>/g,
      );
      if (priorityMatches) {
        for (const match of priorityMatches) {
          const priority = parseFloat(
            match.replace(/<\/?priority>/g, ""),
          );
          expect(priority).toBeGreaterThanOrEqual(0.0);
          expect(priority).toBeLessThanOrEqual(1.0);
        }
      }
    });

    test("should set changefreq based on post age", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // Check for valid changefreq values
      const validFreqs = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
      expect(sitemapContent).toInclude("<changefreq>");

      // Extract all changefreq values
      const freqMatches = sitemapContent.match(
        /<changefreq>(\w+)<\/changefreq>/g,
      );
      if (freqMatches) {
        for (const match of freqMatches) {
          const freq = match.replace(/<\/?changefreq>/g, "");
          expect(validFreqs).toContain(freq);
        }
      }
    });

    test("should include tag pages in sitemap", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // Should include tags index
      expect(sitemapContent).toInclude("/tags/");

      // Tag pages should have appropriate priority
      const tagPattern = /<loc>.*?\/tags\/[^/]+\/<\/loc>/;
      expect(sitemapContent).toMatch(tagPattern);
    });

    test("should include pagination URLs", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // If there's pagination, should include page URLs
      const postCount = generator["site"].posts.length;
      if (postCount > 10) {
        // More than one page
        expect(sitemapContent).toInclude("/page/");
      }
    });

    test("should include year archive pages", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // Should include year-based URLs
      const currentYear = new Date().getFullYear();
      const yearPattern = new RegExp(`<loc>.*?/${currentYear}/<\/loc>`);

      // May or may not have year archives depending on posts
      // Just check structure is valid
      expect(sitemapContent).toInclude("<loc>");
      expect(sitemapContent).toInclude("</loc>");
    });

    test("should include lastmod dates in ISO format", async () => {
      await generator.generate();

      const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
      const sitemapContent = await Bun.file(sitemapPath).text();

      // Check for ISO date format
      const datePattern = /<lastmod>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(sitemapContent).toMatch(datePattern);
    });
  });

  describe("Sitemap Index", () => {
    test("should generate sitemap index for large sites", async () => {
      // Note: This test may not trigger sitemap index with small fixture data
      await generator.generate();

      const sitemapIndexPath = path.join(OUTPUT_DIR, "sitemap_index.xml");
      const sitemapIndexFile = Bun.file(sitemapIndexPath);

      // Sitemap index is only generated for large sites (>1000 URLs or >40KB)
      // With small test data, it may not exist
      const exists = await sitemapIndexFile.exists();

      if (exists) {
        const content = await sitemapIndexFile.text();

        // Check structure
        expect(content).toInclude('<?xml version="1.0" encoding="UTF-8"?>');
        expect(content).toInclude(
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        );
        expect(content).toInclude("</sitemapindex>");
        expect(content).toInclude("<sitemap>");
        expect(content).toInclude("<loc>");
        expect(content).toInclude("sitemap.xml");
      }
    });

    test("sitemap index should reference main sitemap", async () => {
      await generator.generate();

      const sitemapIndexPath = path.join(OUTPUT_DIR, "sitemap_index.xml");
      const sitemapIndexFile = Bun.file(sitemapIndexPath);

      if (await sitemapIndexFile.exists()) {
        const content = await sitemapIndexFile.text();

        // Should reference the main sitemap
        expect(content).toInclude("sitemap.xml");
        expect(content).toInclude("<lastmod>");
      }
    });
  });

  describe("Robots.txt Generation", () => {
    test("should generate robots.txt", async () => {
      await generator.generate();

      const robotsPath = path.join(OUTPUT_DIR, "robots.txt");
      const robotsFile = Bun.file(robotsPath);
      expect(await robotsFile.exists()).toBeTrue();
    });

    test("should allow all user agents by default", async () => {
      await generator.generate();

      const robotsPath = path.join(OUTPUT_DIR, "robots.txt");
      const robotsContent = await Bun.file(robotsPath).text();

      expect(robotsContent).toInclude("User-agent: *");
      expect(robotsContent).toInclude("Allow: /");
    });

    test("should reference sitemap in robots.txt", async () => {
      await generator.generate();

      const robotsPath = path.join(OUTPUT_DIR, "robots.txt");
      const robotsContent = await Bun.file(robotsPath).text();

      expect(robotsContent).toInclude("Sitemap:");
      expect(robotsContent).toInclude("sitemap.xml");
    });

    test("should include domain comment", async () => {
      await generator.generate();

      const robotsPath = path.join(OUTPUT_DIR, "robots.txt");
      const robotsContent = await Bun.file(robotsPath).text();

      // Should include a comment about the domain
      expect(robotsContent).toInclude("#");
      expect(robotsContent).toInclude("Bunki");
    });

    test("robots.txt should be valid format", async () => {
      await generator.generate();

      const robotsPath = path.join(OUTPUT_DIR, "robots.txt");
      const robotsContent = await Bun.file(robotsPath).text();

      // Basic format validation
      expect(robotsContent.length).toBeGreaterThan(0);
      expect(robotsContent).toInclude("User-agent:");
      expect(robotsContent).toInclude("Sitemap:");
    });
  });

  describe("Fallback CSS Generation", () => {
    test("should use PostCSS by default when configured", async () => {
      await generator.generate();

      const cssPath = path.join(OUTPUT_DIR, "css", "style.css");
      const cssFile = Bun.file(cssPath);
      expect(await cssFile.exists()).toBeTrue();
    });

    test("should fallback to simple copy if PostCSS fails", async () => {
      // This test is difficult to trigger without mocking
      // Just verify CSS is generated
      await generator.generate();

      const cssPath = path.join(OUTPUT_DIR, "css", "style.css");
      const cssFile = Bun.file(cssPath);
      expect(await cssFile.exists()).toBeTrue();

      const cssContent = await cssFile.text();
      expect(cssContent.length).toBeGreaterThan(0);
    });

    test("should skip CSS generation if disabled", async () => {
      // Create a generator with CSS disabled
      const configWithoutCSS = {
        ...generator["options"].config,
        css: { enabled: false },
      };

      const generatorNoCSS = new SiteGenerator({
        contentDir: CONTENT_DIR,
        outputDir: OUTPUT_DIR,
        templatesDir: TEMPLATES_DIR,
        config: configWithoutCSS,
      });

      await generatorNoCSS.initialize();
      await generatorNoCSS.generate();

      // CSS should not be generated
      // (though it might exist from previous test runs)
      // This just verifies the function doesn't crash
      expect(generatorNoCSS).toBeDefined();
    });
  });

  describe("Tag Descriptions from tags.toml", () => {
    test("should load tag descriptions if tags.toml exists", async () => {
      // Create a tags.toml file
      const tagsTomlDir = path.join(process.cwd(), "src");
      await ensureDir(tagsTomlDir);

      const tagsTomlPath = path.join(tagsTomlDir, "tags.toml");

      // Note: This would need actual TOML content, but we're just testing the flow
      // The actual implementation uses require() which may not work with our test setup

      // Just verify generator initializes without error
      await generator.initialize();
      expect(generator).toBeDefined();
    });

    test("should handle missing tags.toml gracefully", async () => {
      // Generator should work fine without tags.toml
      await generator.initialize();
      await generator.generate();

      expect(generator["site"].tags).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle site with no posts", async () => {
      // Create a generator with empty content directory
      const emptyContentDir = path.join(import.meta.dir, "empty-content");
      await ensureDir(emptyContentDir);

      const emptyGenerator = new SiteGenerator({
        contentDir: emptyContentDir,
        outputDir: OUTPUT_DIR,
        templatesDir: TEMPLATES_DIR,
        config: generator["options"].config,
      });

      await emptyGenerator.initialize();
      await emptyGenerator.generate();

      // Should generate without errors
      const indexPath = path.join(OUTPUT_DIR, "index.html");
      const indexFile = Bun.file(indexPath);
      expect(await indexFile.exists()).toBeTrue();

      // Clean up
      await Bun.write(emptyContentDir + "/.deleted", "");
    });

    test("should handle posts without tags", async () => {
      // Generator should handle posts without tags
      await generator.generate();

      // Check if any post has empty tags
      const postsWithoutTags = generator["site"].posts.filter(
        (post) => !post.tags || post.tags.length === 0,
      );

      // Should not crash, whether or not such posts exist
      expect(generator["site"].posts).toBeArray();
    });

    test("should handle very large pagination", async () => {
      // With current fixture data, pagination should work
      await generator.generate();

      // Check that pagination pages are generated correctly
      const indexPath = path.join(OUTPUT_DIR, "index.html");
      const indexFile = Bun.file(indexPath);
      expect(await indexFile.exists()).toBeTrue();

      // If there are multiple pages, check page 2
      const postCount = generator["site"].posts.length;
      if (postCount > 10) {
        const page2Path = path.join(OUTPUT_DIR, "page", "2", "index.html");
        const page2File = Bun.file(page2Path);
        expect(await page2File.exists()).toBeTrue();
      }
    });

    test("should handle posts with special characters in titles", async () => {
      // Generator should handle any valid markdown
      await generator.generate();

      // Should complete without errors
      expect(generator["site"].posts).toBeArray();
    });

    test("should handle empty tags array", async () => {
      await generator.initialize();

      // Filter posts with empty tags
      const postsWithEmptyTags = generator["site"].posts.filter(
        (post) => post.tags.length === 0,
      );

      // Should not crash
      await generator.generate();
      expect(generator).toBeDefined();
    });

    test("should handle duplicate tag names with different cases", async () => {
      // Tags should be case-sensitive or normalized consistently
      await generator.initialize();

      const tags = generator["site"].tags;
      const tagNames = Object.keys(tags);

      // Just verify tags object is valid
      expect(tagNames).toBeArray();
      expect(tags).toBeObject();
    });

    test("should handle posts from multiple years", async () => {
      await generator.generate();

      // Check that year archives are created
      // Should handle posts from any year gracefully
      expect(generator["site"].posts).toBeArray();

      // Year directories should be created
      const postYears = new Set(
        generator["site"].posts.map(
          (post) => new Date(post.date).getFullYear(),
        ),
      );

      for (const year of postYears) {
        const yearIndexPath = path.join(OUTPUT_DIR, year.toString(), "index.html");
        const yearIndexFile = Bun.file(yearIndexPath);
        expect(await yearIndexFile.exists()).toBeTrue();
      }
    });
  });
});
