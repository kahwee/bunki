import { describe, test, expect, afterAll } from "bun:test";
import path from "path";
import { mkdir, rm } from "node:fs/promises";
import {
  detectChanges,
  getAffectedTags,
  needsIndexRegeneration,
  estimateTimeSaved,
} from "../../src/utils/change-detector";
import {
  createEmptyCache,
  updateCacheEntry,
  getFileMtime,
  hashFile,
} from "../../src/utils/build-cache";
import type { Post, ChangeSet } from "../../src/utils/change-detector";

// Re-export ChangeSet since it's declared in change-detector
export type { ChangeSet };

const TMP = path.join(import.meta.dir, "tmp-change-detector");

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

async function writeTmp(name: string, content = "content"): Promise<string> {
  await mkdir(TMP, { recursive: true });
  const filePath = path.join(TMP, name);
  await Bun.write(filePath, content);
  return filePath;
}

/** Build a cache entry that matches the current file (no changes) */
async function primeCache(cache: ReturnType<typeof createEmptyCache>, filePath: string) {
  await updateCacheEntry(filePath, cache);
}

describe("detectChanges", () => {
  test("returns no changes when everything matches cache", async () => {
    const postFile = await writeTmp("stable-post.md");
    const cache = createEmptyCache();
    await primeCache(cache, postFile);

    const result = await detectChanges([postFile], cache);
    expect(result.changedPosts).toHaveLength(0);
    expect(result.deletedPosts).toHaveLength(0);
    expect(result.stylesChanged).toBe(false);
    expect(result.configChanged).toBe(false);
    expect(result.templatesChanged).toBe(false);
    expect(result.fullRebuild).toBe(false);
  });

  test("detects new/changed posts not in cache", async () => {
    const newPost = await writeTmp("new-post.md");
    const cache = createEmptyCache(); // empty — file not cached

    const result = await detectChanges([newPost], cache);
    expect(result.changedPosts).toContain(newPost);
    expect(result.fullRebuild).toBe(false);
  });

  test("detects deleted posts (in cache but not in current files)", async () => {
    const deletedPost = "/content/2025/deleted-post.md";
    const cache = createEmptyCache();
    cache.files[deletedPost] = { hash: "abc", mtime: 123 };

    // currentFiles does NOT include deletedPost
    const result = await detectChanges([], cache);
    expect(result.deletedPosts).toContain(deletedPost);
    expect(result.fullRebuild).toBe(true);
  });

  test("only flags .md files as deleted posts (ignores non-md cache entries)", async () => {
    const cache = createEmptyCache();
    cache.files["/templates/base.njk"] = { hash: "abc", mtime: 123 };
    cache.files["/content/2025/deleted.md"] = { hash: "def", mtime: 456 };

    const result = await detectChanges([], cache);
    expect(result.deletedPosts).toContain("/content/2025/deleted.md");
    expect(result.deletedPosts).not.toContain("/templates/base.njk");
  });

  test("config change triggers fullRebuild immediately", async () => {
    const configFile = await writeTmp("bunki.config.ts", "export default { title: 'v2' }");
    const cache = createEmptyCache(); // config not in cache = changed

    const result = await detectChanges([], cache, { configPath: configFile });
    expect(result.configChanged).toBe(true);
    expect(result.fullRebuild).toBe(true);
    // Should return early — no further checks
    expect(result.changedPosts).toHaveLength(0);
  });

  test("config unchanged does not trigger fullRebuild", async () => {
    const configFile = await writeTmp("stable-config.ts", "export default {}");
    const cache = createEmptyCache();
    // detectChanges uses hasFileChanged (cache.files), so prime via updateCacheEntry
    await primeCache(cache, configFile);

    const result = await detectChanges([], cache, { configPath: configFile });
    expect(result.configChanged).toBe(false);
    expect(result.fullRebuild).toBe(false);
  });

  test("template change triggers fullRebuild immediately", async () => {
    const templateFile = await writeTmp("base.njk", "<html></html>");
    const cache = createEmptyCache(); // template not in cache = changed

    const result = await detectChanges([], cache, { templatePaths: [templateFile] });
    expect(result.templatesChanged).toBe(true);
    expect(result.fullRebuild).toBe(true);
  });

  test("template unchanged does not trigger fullRebuild", async () => {
    const templateFile = await writeTmp("stable-base.njk", "<html></html>");
    const cache = createEmptyCache();
    await primeCache(cache, templateFile);

    const result = await detectChanges([], cache, { templatePaths: [templateFile] });
    expect(result.templatesChanged).toBe(false);
    expect(result.fullRebuild).toBe(false);
  });

  test("style change sets stylesChanged (does not force fullRebuild)", async () => {
    const styleFile = await writeTmp("main.css", "body { color: red; }");
    const cache = createEmptyCache(); // not cached = changed

    const result = await detectChanges([], cache, { stylesPaths: [styleFile] });
    expect(result.stylesChanged).toBe(true);
    expect(result.fullRebuild).toBe(false);
  });

  test("multiple unchanged styles do not set stylesChanged", async () => {
    const style1 = await writeTmp("style1.css", "body {}");
    const style2 = await writeTmp("style2.css", "p {}");
    const cache = createEmptyCache();
    await primeCache(cache, style1);
    await primeCache(cache, style2);

    const result = await detectChanges([], cache, { stylesPaths: [style1, style2] });
    expect(result.stylesChanged).toBe(false);
  });

  test("detects changed post when not in cache", async () => {
    const post1 = await writeTmp("post1.md", "# Post 1");
    const post2 = await writeTmp("post2.md", "# Post 2");
    const cache = createEmptyCache();
    await primeCache(cache, post1); // post1 is cached, post2 is not

    const result = await detectChanges([post1, post2], cache);
    expect(result.changedPosts).not.toContain(post1);
    expect(result.changedPosts).toContain(post2);
  });

  test("with no options, detects only post changes and deletions", async () => {
    const post = await writeTmp("post-only.md");
    const cache = createEmptyCache();

    const result = await detectChanges([post], cache);
    expect(result.changedPosts).toContain(post);
    expect(result.configChanged).toBe(false);
    expect(result.templatesChanged).toBe(false);
    expect(result.stylesChanged).toBe(false);
  });
});

describe("getAffectedTags", () => {
  function makePost(tags: string[]): Post {
    return {
      title: "Test",
      date: "2025-01-01",
      tags,
      tagSlugs: {},
      content: "",
      slug: "test",
      url: "/2025/test/",
      excerpt: "",
      html: "",
    } as Post;
  }

  test("returns all tags from changed posts", () => {
    const changed = [
      makePost(["javascript", "typescript"]),
      makePost(["react", "javascript"]),
    ];
    const tags = getAffectedTags(changed, []);
    expect(tags.has("javascript")).toBe(true);
    expect(tags.has("typescript")).toBe(true);
    expect(tags.has("react")).toBe(true);
    expect(tags.size).toBe(3);
  });

  test("returns empty set when no changed posts", () => {
    expect(getAffectedTags([], []).size).toBe(0);
  });

  test("returns empty set for posts with no tags", () => {
    const changed = [makePost([])];
    expect(getAffectedTags(changed, []).size).toBe(0);
  });

  test("deduplicates tags appearing in multiple posts", () => {
    const changed = [makePost(["shared"]), makePost(["shared"])];
    const tags = getAffectedTags(changed, []);
    expect(tags.size).toBe(1);
    expect(tags.has("shared")).toBe(true);
  });
});

describe("needsIndexRegeneration", () => {
  function makeChangeSet(overrides: Partial<ReturnType<typeof createEmptyChangeSet>>) {
    return { ...createEmptyChangeSet(), ...overrides };
  }

  function createEmptyChangeSet() {
    return {
      changedPosts: [] as string[],
      deletedPosts: [] as string[],
      stylesChanged: false,
      configChanged: false,
      templatesChanged: false,
      fullRebuild: false,
    };
  }

  test("returns true when posts were changed", () => {
    expect(needsIndexRegeneration(makeChangeSet({ changedPosts: ["/post.md"] }))).toBe(true);
  });

  test("returns true when posts were deleted", () => {
    expect(needsIndexRegeneration(makeChangeSet({ deletedPosts: ["/old.md"] }))).toBe(true);
  });

  test("returns true when fullRebuild is set", () => {
    expect(needsIndexRegeneration(makeChangeSet({ fullRebuild: true }))).toBe(true);
  });

  test("returns false when nothing changed", () => {
    expect(needsIndexRegeneration(makeChangeSet({}))).toBe(false);
  });

  test("returns false when only styles changed", () => {
    expect(needsIndexRegeneration(makeChangeSet({ stylesChanged: true }))).toBe(false);
  });
});

describe("estimateTimeSaved", () => {
  test("returns 0 when all posts changed", () => {
    expect(estimateTimeSaved(10, 10)).toBe(0);
  });

  test("returns time for skipped posts (6ms each)", () => {
    expect(estimateTimeSaved(10, 2)).toBe(48); // 8 skipped × 6ms
  });

  test("returns full time when no posts changed", () => {
    expect(estimateTimeSaved(100, 0)).toBe(600); // 100 × 6ms
  });

  test("returns 0 for 0 total posts", () => {
    expect(estimateTimeSaved(0, 0)).toBe(0);
  });
});
