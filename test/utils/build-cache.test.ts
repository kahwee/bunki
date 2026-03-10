import { describe, test, expect, afterAll } from "bun:test";
import path from "path";
import { mkdir, rm } from "node:fs/promises";
import {
  hashFile,
  getFileMtime,
  loadCache,
  saveCache,
  createEmptyCache,
  hasFileChanged,
  updateCacheEntry,
  removeCacheEntry,
  hasConfigChanged,
  markFullBuild,
  needsFullRebuild,
  loadCachedPosts,
} from "../../src/utils/build-cache";
import type { Post } from "../../src/types";

const TMP = path.join(import.meta.dir, "tmp-build-cache");

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

async function writeTmp(name: string, content: string): Promise<string> {
  await mkdir(TMP, { recursive: true });
  const filePath = path.join(TMP, name);
  await Bun.write(filePath, content);
  return filePath;
}

describe("hashFile", () => {
  test("returns a non-empty hash for an existing file", async () => {
    const filePath = await writeTmp("hash-test.txt", "hello world");
    const result = await hashFile(filePath);
    expect(result).toBeString();
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns empty string for non-existent file", async () => {
    const result = await hashFile(path.join(TMP, "does-not-exist.txt"));
    expect(result).toBe("");
  });

  test("returns same hash for same content", async () => {
    const a = await writeTmp("hash-a.txt", "same content");
    const b = await writeTmp("hash-b.txt", "same content");
    expect(await hashFile(a)).toBe(await hashFile(b));
  });

  test("returns different hash for different content", async () => {
    const a = await writeTmp("hash-diff-a.txt", "content A");
    const b = await writeTmp("hash-diff-b.txt", "content B");
    expect(await hashFile(a)).not.toBe(await hashFile(b));
  });
});

describe("getFileMtime", () => {
  test("returns a number for an existing file", async () => {
    const filePath = await writeTmp("mtime-test.txt", "data");
    const mtime = await getFileMtime(filePath);
    expect(mtime).toBeNumber();
    expect(mtime).toBeGreaterThan(0);
  });

  test("returns 0 for non-existent file", async () => {
    const mtime = await getFileMtime(path.join(TMP, "no-such-file.txt"));
    expect(mtime).toBe(0);
  });
});

describe("createEmptyCache", () => {
  test("returns cache with correct version and empty files", () => {
    const cache = createEmptyCache();
    expect(cache.version).toBeString();
    expect(cache.files).toEqual({});
    expect(cache.lastFullBuild).toBeUndefined();
  });
});

describe("saveCache and loadCache", () => {
  test("roundtrip: save then load returns the same data", async () => {
    const cacheDir = path.join(TMP, "cache-roundtrip");
    await mkdir(cacheDir, { recursive: true });

    const cache = createEmptyCache();
    cache.files["/some/file.md"] = { hash: "abc123", mtime: 1234567890 };
    await saveCache(cacheDir, cache);

    const loaded = await loadCache(cacheDir);
    expect(loaded.files["/some/file.md"]).toEqual({
      hash: "abc123",
      mtime: 1234567890,
    });
  });

  test("returns empty cache when no cache file exists", async () => {
    const emptyDir = path.join(TMP, "no-cache-dir");
    await mkdir(emptyDir, { recursive: true });
    const cache = await loadCache(emptyDir);
    expect(cache.files).toEqual({});
  });

  test("returns empty cache on version mismatch", async () => {
    const dir = path.join(TMP, "version-mismatch");
    await mkdir(dir, { recursive: true });

    // Write a cache with an old version
    const staleCache = { version: "0.0.1", files: { "/old.md": { hash: "x", mtime: 0 } } };
    await Bun.write(path.join(dir, ".bunki-cache.json"), JSON.stringify(staleCache));

    const loaded = await loadCache(dir);
    expect(loaded.files).toEqual({});
  });

  test("returns empty cache on malformed JSON", async () => {
    const dir = path.join(TMP, "bad-json");
    await mkdir(dir, { recursive: true });
    await Bun.write(path.join(dir, ".bunki-cache.json"), "not valid json {{");
    const loaded = await loadCache(dir);
    expect(loaded.files).toEqual({});
  });
});

describe("hasFileChanged", () => {
  test("returns true when file is not in cache", async () => {
    const filePath = await writeTmp("new-file.md", "content");
    const cache = createEmptyCache();
    expect(await hasFileChanged(filePath, cache)).toBe(true);
  });

  test("returns false when mtime matches (no hash check needed)", async () => {
    const filePath = await writeTmp("unchanged.md", "stable content");
    const mtime = await getFileMtime(filePath);
    const fileHash = await hashFile(filePath);
    const cache = createEmptyCache();
    cache.files[filePath] = { hash: fileHash, mtime };
    expect(await hasFileChanged(filePath, cache)).toBe(false);
  });

  test("returns true when mtime and hash both changed", async () => {
    const filePath = await writeTmp("changed.md", "new content");
    const cache = createEmptyCache();
    cache.files[filePath] = { hash: "stale-hash", mtime: 0 };
    expect(await hasFileChanged(filePath, cache)).toBe(true);
  });

  test("returns false when mtime changed but hash is same (content unchanged)", async () => {
    const filePath = await writeTmp("same-content.md", "identical content");
    const fileHash = await hashFile(filePath);
    const cache = createEmptyCache();
    // Use mtime=0 so it triggers hash comparison, but supply correct hash
    cache.files[filePath] = { hash: fileHash, mtime: 0 };
    expect(await hasFileChanged(filePath, cache)).toBe(false);
  });
});

describe("updateCacheEntry", () => {
  test("adds entry with hash and mtime", async () => {
    const filePath = await writeTmp("update-test.md", "update me");
    const cache = createEmptyCache();
    await updateCacheEntry(filePath, cache);
    expect(cache.files[filePath]).toBeDefined();
    expect(cache.files[filePath].hash).toBeString();
    expect(cache.files[filePath].mtime).toBeNumber();
    expect(cache.files[filePath].post).toBeUndefined();
  });

  test("stores optional post data", async () => {
    const filePath = await writeTmp("update-with-post.md", "has post");
    const cache = createEmptyCache();
    const post = { title: "Test", slug: "test" } as Post;
    await updateCacheEntry(filePath, cache, { post });
    expect(cache.files[filePath].post?.title).toBe("Test");
  });

  test("stores optional outputs", async () => {
    const filePath = await writeTmp("update-with-outputs.md", "has outputs");
    const cache = createEmptyCache();
    await updateCacheEntry(filePath, cache, { outputs: ["/dist/test/index.html"] });
    expect(cache.files[filePath].outputs).toEqual(["/dist/test/index.html"]);
  });
});

describe("removeCacheEntry", () => {
  test("removes an existing entry", () => {
    const cache = createEmptyCache();
    cache.files["/some/file.md"] = { hash: "abc", mtime: 123 };
    removeCacheEntry("/some/file.md", cache);
    expect(cache.files["/some/file.md"]).toBeUndefined();
  });

  test("is a no-op for non-existent entry", () => {
    const cache = createEmptyCache();
    expect(() => removeCacheEntry("/not/there.md", cache)).not.toThrow();
  });
});

describe("hasConfigChanged", () => {
  test("returns true and sets configHash when no previous hash", async () => {
    const configPath = await writeTmp("config1.ts", "export default {}");
    const cache = createEmptyCache();
    expect(await hasConfigChanged(configPath, cache)).toBe(true);
    expect(cache.configHash).toBeString();
  });

  test("returns false when config hash matches", async () => {
    const configPath = await writeTmp("config-same.ts", "export default {}");
    const cache = createEmptyCache();
    await hasConfigChanged(configPath, cache); // prime the hash
    expect(await hasConfigChanged(configPath, cache)).toBe(false);
  });

  test("returns true when config content changes", async () => {
    const configPath = await writeTmp("config-change.ts", "version 1");
    const cache = createEmptyCache();
    await hasConfigChanged(configPath, cache); // prime

    await Bun.write(configPath, "version 2");
    expect(await hasConfigChanged(configPath, cache)).toBe(true);
  });
});

describe("markFullBuild", () => {
  test("sets lastFullBuild to current time", () => {
    const cache = createEmptyCache();
    const before = Date.now();
    markFullBuild(cache);
    const after = Date.now();
    expect(cache.lastFullBuild).toBeGreaterThanOrEqual(before);
    expect(cache.lastFullBuild).toBeLessThanOrEqual(after);
  });
});

describe("needsFullRebuild", () => {
  test("returns true when lastFullBuild is not set", () => {
    const cache = createEmptyCache();
    expect(needsFullRebuild(cache, 60_000)).toBe(true);
  });

  test("returns false when last build is within maxAge", () => {
    const cache = createEmptyCache();
    cache.lastFullBuild = Date.now() - 1000; // 1 second ago
    expect(needsFullRebuild(cache, 60_000)).toBe(false);
  });

  test("returns true when last build exceeds maxAge", () => {
    const cache = createEmptyCache();
    cache.lastFullBuild = Date.now() - 120_000; // 2 minutes ago
    expect(needsFullRebuild(cache, 60_000)).toBe(true);
  });
});

describe("loadCachedPosts", () => {
  test("returns posts for files that have cached post data", () => {
    const cache = createEmptyCache();
    const post = { title: "Cached Post", slug: "cached-post" } as Post;
    cache.files["/content/2025/cached-post.md"] = { hash: "abc", mtime: 123, post };
    cache.files["/content/2025/no-post.md"] = { hash: "def", mtime: 456 };

    const posts = loadCachedPosts(cache, [
      "/content/2025/cached-post.md",
      "/content/2025/no-post.md",
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Cached Post");
  });

  test("returns empty array when no files have cached posts", () => {
    const cache = createEmptyCache();
    cache.files["/file.md"] = { hash: "abc", mtime: 123 };
    expect(loadCachedPosts(cache, ["/file.md"])).toEqual([]);
  });

  test("returns empty array for empty file list", () => {
    const cache = createEmptyCache();
    expect(loadCachedPosts(cache, [])).toEqual([]);
  });

  test("ignores file paths not in cache", () => {
    const cache = createEmptyCache();
    expect(loadCachedPosts(cache, ["/not/in/cache.md"])).toEqual([]);
  });
});
