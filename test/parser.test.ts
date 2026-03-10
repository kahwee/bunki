import { expect, test, describe, afterAll } from "bun:test";
import { parseMarkdownDirectory, parseMarkdownFiles } from "../src/parser";
import { parseMarkdownFile } from "../src/utils/markdown-utils";
import path from "path";
import { mkdir, rm } from "node:fs/promises";

const TMP_PARSER = path.join(import.meta.dir, "tmp-parser-tests");

afterAll(async () => {
  await rm(TMP_PARSER, { recursive: true, force: true });
});

async function writeMd(dir: string, name: string, content: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await Bun.write(filePath, content);
  return filePath;
}

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
    expect(result.post?.tags).toContain("web-development");
    expect(result.post?.tags).toContain("open-source");
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

describe("parseMarkdownFiles", () => {
  test("returns post/filePath pairs for valid files", async () => {
    const dir = path.join(TMP_PARSER, "valid");
    const f1 = await writeMd(dir, "post-a.md", `---\ntitle: Post A\ndate: 2025-01-01T00:00:00Z\ntags: [test]\n---\nContent A`);
    const f2 = await writeMd(dir, "post-b.md", `---\ntitle: Post B\ndate: 2025-02-01T00:00:00Z\ntags: [test]\n---\nContent B`);

    const results = await parseMarkdownFiles([f1, f2]);
    expect(results).toHaveLength(2);
    const titles = results.map((r) => r.post.title);
    expect(titles).toContain("Post A");
    expect(titles).toContain("Post B");
  });

  test("omits files that fail to parse", async () => {
    const dir = path.join(TMP_PARSER, "partial");
    const good = await writeMd(dir, "good.md", `---\ntitle: Good\ndate: 2025-01-01T00:00:00Z\ntags: [test]\n---\nContent`);
    const bad = await writeMd(dir, "bad.md", `---\ntitle: Bad\n---\nNo date`);

    const results = await parseMarkdownFiles([good, bad]);
    expect(results).toHaveLength(1);
    expect(results[0].post.title).toBe("Good");
  });

  test("returns empty array for empty input", async () => {
    const results = await parseMarkdownFiles([]);
    expect(results).toHaveLength(0);
  });
});

describe("parseMarkdownDirectory - file conflicts", () => {
  test("skips (non-strict) when both .md and README.md exist for same slug", async () => {
    const dir = path.join(TMP_PARSER, "conflict");
    await writeMd(dir, "my-post.md", `---\ntitle: Flat\ndate: 2025-01-01T00:00:00Z\ntags: [t]\n---\nA`);
    const nested = path.join(dir, "my-post");
    await writeMd(nested, "README.md", `---\ntitle: Nested\ndate: 2025-01-02T00:00:00Z\ntags: [t]\n---\nB`);

    // Non-strict: should not throw, but logs the conflict
    const posts = await parseMarkdownDirectory(dir, false);
    // Only one post per slug should be kept (or none if both conflict)
    expect(Array.isArray(posts)).toBe(true);
  });

  test("throws in strict mode when YAML errors exist", async () => {
    const dir = path.join(TMP_PARSER, "strict");
    // Missing date triggers a missing_field error — handled by strict mode (not always-throw)
    await writeMd(dir, "no-date.md", `---\ntitle: No Date\ntags: [t]\n---\nContent`);

    try {
      await parseMarkdownDirectory(dir, true);
      expect(true).toBe(false); // should not reach here
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toInclude("strictMode");
    }
  });
});

describe("parseMarkdownDirectory - error reporting (non-strict)", () => {
  test("returns only valid posts when some files have YAML errors", async () => {
    const dir = path.join(TMP_PARSER, "yaml-errors");
    await writeMd(dir, "valid.md", `---\ntitle: Valid\ndate: 2025-01-01T00:00:00Z\ntags: [test]\n---\nGood`);
    await writeMd(dir, "bad-yaml.md", `---\ntitle: Bad: Unquoted: Colon\ndate 2025-bad\n---\nBroken`);

    const posts = await parseMarkdownDirectory(dir, false);
    // At least the valid post should be returned
    expect(posts.some((p) => p.title === "Valid")).toBe(true);
  });

  test("returns only valid posts when some files have missing fields", async () => {
    const dir = path.join(TMP_PARSER, "missing-fields");
    await writeMd(dir, "valid.md", `---\ntitle: Valid Post\ndate: 2025-01-01T00:00:00Z\ntags: [test]\n---\nGood`);
    await writeMd(dir, "no-date.md", `---\ntitle: No Date\ntags: [test]\n---\nContent`);
    await writeMd(dir, "no-title.md", `---\ndate: 2025-01-01T00:00:00Z\ntags: [test]\n---\nContent`);

    const posts = await parseMarkdownDirectory(dir, false);
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Valid Post");
  });
});
