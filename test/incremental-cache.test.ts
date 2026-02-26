/**
 * Regression test for incremental cache-write bug.
 *
 * Bug: full-rebuild path used index-based pairing (allFiles[i] ↔ posts[i]).
 * parseMarkdownDirectory sorts posts by date; findFilesByPattern returns them
 * alphabetically. When alphabetical order differs from date order the wrong
 * post data gets cached for each file — causing stale/wrong posts on
 * subsequent incremental builds.
 *
 * Fix: use parseMarkdownFiles() which returns {post, filePath} pairs, so each
 * filePath is always paired with the post derived from that exact file.
 */

import { expect, test, describe, afterAll } from "bun:test";
import path from "path";
import { parseMarkdownFiles } from "../src/parser";
import { createEmptyCache, updateCacheEntry } from "../src/utils/build-cache";
import { ensureDir } from "../src/utils/file-utils";

const TMP_DIR = path.join(import.meta.dir, "tmp-cache-test");

// Markdown files are named so that alphabetical order ≠ date order.
// Alphabetical:  a-zebra.md  b-middle.md  c-alpha.md
// Date order:    c-alpha     b-middle     a-zebra     (newest → oldest)
const FILES = [
  {
    name: "a-zebra.md",
    title: "Zebra Post",
    date: "2020-01-01T00:00:00",
  },
  {
    name: "b-middle.md",
    title: "Middle Post",
    date: "2022-06-15T00:00:00",
  },
  {
    name: "c-alpha.md",
    title: "Alpha Post",
    date: "2024-12-31T00:00:00",
  },
];

async function writeTempFiles() {
  await ensureDir(TMP_DIR);
  const paths: string[] = [];
  for (const f of FILES) {
    const filePath = path.join(TMP_DIR, f.name);
    await Bun.write(
      filePath,
      `---
title: "${f.title}"
date: ${f.date}
description: "Test post for ${f.title}"
tags: ["test"]
---

Content for ${f.title}.
`,
    );
    paths.push(filePath);
  }
  return paths;
}

afterAll(async () => {
  // Clean up temp files
  const { rmdir } = await import("fs/promises");
  await rmdir(TMP_DIR, { recursive: true }).catch(() => {});
});

describe("incremental cache: full-rebuild cache-write correctness", () => {
  test("each file path is cached with its own post data (not a date-sorted neighbour)", async () => {
    const allFiles = await writeTempFiles();

    // This is the fixed code path: parseMarkdownFiles returns correct
    // {post, filePath} pairs regardless of date ordering.
    const cache = createEmptyCache();
    const postsWithPaths = await parseMarkdownFiles(allFiles);
    for (const { post, filePath } of postsWithPaths) {
      await updateCacheEntry(filePath, cache, { post });
    }

    // Verify each file has its own post cached — not a neighbour's.
    for (const f of FILES) {
      const filePath = path.join(TMP_DIR, f.name);
      const entry = cache.files[filePath];
      expect(entry).toBeDefined();
      expect(entry?.post?.title).toBe(f.title);
    }
  });

  test("demonstrates the old bug: index-based pairing produces wrong cache entries", async () => {
    const allFiles = await writeTempFiles();

    // Simulate the old buggy code:
    //   posts = parseMarkdownDirectory() → date-sorted (newest first)
    //   allFiles = findFilesByPattern()  → alphabetical order
    //   cache[allFiles[i]] = posts[i]   → mismatched!
    const { parseMarkdownDirectory } = await import("../src/parser");
    const posts = await parseMarkdownDirectory(TMP_DIR);
    // posts[0] = Alpha Post (2024), posts[1] = Middle Post, posts[2] = Zebra Post (2020)
    // allFiles[0] = a-zebra.md, allFiles[1] = b-middle.md, allFiles[2] = c-alpha.md

    const buggyCache = createEmptyCache();
    for (let i = 0; i < allFiles.length; i++) {
      await updateCacheEntry(allFiles[i], buggyCache, { post: posts[i] });
    }

    // a-zebra.md gets "Alpha Post" (newest) — WRONG
    const zebraEntry = buggyCache.files[path.join(TMP_DIR, "a-zebra.md")];
    expect(zebraEntry?.post?.title).not.toBe("Zebra Post");
    expect(zebraEntry?.post?.title).toBe("Alpha Post");

    // c-alpha.md gets "Zebra Post" (oldest) — WRONG
    const alphaEntry = buggyCache.files[path.join(TMP_DIR, "c-alpha.md")];
    expect(alphaEntry?.post?.title).not.toBe("Alpha Post");
    expect(alphaEntry?.post?.title).toBe("Zebra Post");
  });
});
