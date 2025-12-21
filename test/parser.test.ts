import { expect, test, describe } from "bun:test";
import { parseMarkdownDirectory } from "../src/parser";
import { parseMarkdownFile } from "../src/utils/markdown-utils";
import path from "path";

const FIXTURES_DIR = path.join(import.meta.dir, "../fixtures");
const CONTENT_DIR = path.join(FIXTURES_DIR, "content");
const SAMPLE_FILE = path.join(CONTENT_DIR, "2025", "test-post-1.md");

describe("Markdown Parser", () => {
  test("parseMarkdownFile should parse a single markdown file", async () => {
    const result = await parseMarkdownFile(SAMPLE_FILE);

    expect(result.post).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.post).toHaveProperty(
      "title",
      "Testing Bunki: A New Static Site Generator",
    );
    expect(result.post).toHaveProperty("date");
    expect(result.post).toHaveProperty("tags");
    expect(result.post?.tags).toContain("technology");
    expect(result.post?.tags).toContain("web development");
    expect(result.post?.tags).toContain("open source");
    expect(result.post).toHaveProperty("content");
    expect(result.post).toHaveProperty("html");
    expect(result.post).toHaveProperty("excerpt");
    expect(result.post?.excerpt).toInclude("Bunki is a fast");
  });

  test("parseMarkdownDirectory should parse all markdown files", async () => {
    const posts = await parseMarkdownDirectory(CONTENT_DIR);

    expect(posts).toBeArray();
    expect(posts.length).toBeGreaterThan(0);

    // Verify posts are sorted by date (newest first)
    const dates = posts.map((post) => new Date(post.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }

    // Check post structure
    const firstPost = posts[0];
    expect(firstPost).toHaveProperty("title");
    expect(firstPost).toHaveProperty("date");
    expect(firstPost).toHaveProperty("tags");
    expect(firstPost).toHaveProperty("content");
    expect(firstPost).toHaveProperty("html");
    expect(firstPost).toHaveProperty("excerpt");
  });

  test("parseMarkdownDirectory should throw on non-existent directory", async () => {
    // Both strict and non-strict mode should throw when directory doesn't exist
    try {
      await parseMarkdownDirectory("/non/existent/directory", false);
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.code).toBe("ENOENT");
    }
  });
});
