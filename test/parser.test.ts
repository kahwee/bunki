import { expect, test, describe } from "bun:test";
import { parseMarkdownDirectory, parseMarkdownFile } from "../src/parser";
import { parseMarkdownFile as parseMarkdownFileUtil } from "../src/utils/markdown-utils";
import path from "path";

const FIXTURES_DIR = path.join(import.meta.dir, "../fixtures");
const CONTENT_DIR = path.join(FIXTURES_DIR, "content");
const SAMPLE_FILE = path.join(CONTENT_DIR, "2024", "test-post-1.md");

describe("Markdown Parser", () => {
  test("parseMarkdownFile should parse a single markdown file", async () => {
    const post = await parseMarkdownFileUtil(SAMPLE_FILE);
    
    expect(post).not.toBeNull();
    expect(post).toHaveProperty("title", "Testing Bunki: A New Static Site Generator");
    expect(post).toHaveProperty("date");
    expect(post).toHaveProperty("tags");
    expect(post?.tags).toContain("technology");
    expect(post?.tags).toContain("web development");
    expect(post?.tags).toContain("open source");
    expect(post).toHaveProperty("content");
    expect(post).toHaveProperty("html");
    expect(post).toHaveProperty("excerpt");
    expect(post?.excerpt).toInclude("Bunki is a fast");
  });
  
  test("parseMarkdownDirectory should parse all markdown files", async () => {
    const posts = await parseMarkdownDirectory(CONTENT_DIR);
    
    expect(posts).toBeArray();
    expect(posts.length).toBeGreaterThan(0);
    
    // Verify posts are sorted by date (newest first)
    const dates = posts.map(post => new Date(post.date).getTime());
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
});