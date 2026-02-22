/**
 * Build cache for incremental builds
 * Tracks file hashes, modification times, parsed post data, and build outputs
 */

import { hash } from "bun";
import path from "path";
import type { Post } from "../types";

export interface CacheEntry {
  /** Content hash of the file */
  hash: string;
  /** Last modification time (ms since epoch) */
  mtime: number;
  /** Cached parsed post data */
  post?: Post;
  /** Generated output files */
  outputs?: string[];
}

export interface BuildCache {
  /** Version of cache format */
  version: string;
  /** File cache entries */
  files: Record<string, CacheEntry>;
  /** Config file hash */
  configHash?: string;
  /** Last full build timestamp */
  lastFullBuild?: number;
}

const CACHE_VERSION = "2.0.0";
const CACHE_FILENAME = ".bunki-cache.json";

/**
 * Calculate content hash for a file
 */
export async function hashFile(filePath: string): Promise<string> {
  try {
    const file = Bun.file(filePath);
    const content = await file.arrayBuffer();
    return hash(content).toString(36);
  } catch (error) {
    // File doesn't exist or can't be read
    return "";
  }
}

/**
 * Get file modification time
 */
export async function getFileMtime(filePath: string): Promise<number> {
  try {
    const stat = await Bun.file(filePath).stat();
    return stat?.mtime?.getTime() || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Load build cache from disk
 */
export async function loadCache(cwd: string): Promise<BuildCache> {
  const cachePath = path.join(cwd, CACHE_FILENAME);
  const cacheFile = Bun.file(cachePath);

  try {
    if (await cacheFile.exists()) {
      const content = await cacheFile.text();
      const cache = JSON.parse(content) as BuildCache;

      // Validate cache version
      if (cache.version !== CACHE_VERSION) {
        console.log(
          `Cache version mismatch (${cache.version} vs ${CACHE_VERSION}), rebuilding...`,
        );
        return createEmptyCache();
      }

      return cache;
    }
  } catch (error) {
    console.warn("Error loading cache, rebuilding:", error);
  }

  return createEmptyCache();
}

/**
 * Save build cache to disk
 */
export async function saveCache(cwd: string, cache: BuildCache): Promise<void> {
  const cachePath = path.join(cwd, CACHE_FILENAME);

  try {
    await Bun.write(cachePath, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn("Error saving cache:", error);
  }
}

/**
 * Create empty build cache
 */
export function createEmptyCache(): BuildCache {
  return {
    version: CACHE_VERSION,
    files: {},
  };
}

/**
 * Check if a file has changed since last build
 */
export async function hasFileChanged(
  filePath: string,
  cache: BuildCache,
): Promise<boolean> {
  const cached = cache.files[filePath];

  if (!cached) {
    // File not in cache, it's new
    return true;
  }

  // Check modification time first (fast)
  const currentMtime = await getFileMtime(filePath);
  if (currentMtime !== cached.mtime) {
    // mtime changed, verify with hash
    const currentHash = await hashFile(filePath);
    return currentHash !== cached.hash;
  }

  // mtime unchanged, assume file unchanged
  return false;
}

/**
 * Update cache entry for a file
 */
export async function updateCacheEntry(
  filePath: string,
  cache: BuildCache,
  options?: {
    post?: Post;
    outputs?: string[];
  },
): Promise<void> {
  const currentHash = await hashFile(filePath);
  const currentMtime = await getFileMtime(filePath);

  cache.files[filePath] = {
    hash: currentHash,
    mtime: currentMtime,
    post: options?.post,
    outputs: options?.outputs,
  };
}

/**
 * Remove cache entry for a file
 */
export function removeCacheEntry(filePath: string, cache: BuildCache): void {
  delete cache.files[filePath];
}

/**
 * Check if config file has changed
 */
export async function hasConfigChanged(
  configPath: string,
  cache: BuildCache,
): Promise<boolean> {
  const currentHash = await hashFile(configPath);

  if (!cache.configHash) {
    cache.configHash = currentHash;
    return true;
  }

  if (currentHash !== cache.configHash) {
    cache.configHash = currentHash;
    return true;
  }

  return false;
}

/**
 * Mark full build timestamp
 */
export function markFullBuild(cache: BuildCache): void {
  cache.lastFullBuild = Date.now();
}

/**
 * Check if full rebuild is needed
 */
export function needsFullRebuild(cache: BuildCache, maxAge: number): boolean {
  if (!cache.lastFullBuild) {
    return true;
  }

  const age = Date.now() - cache.lastFullBuild;
  return age > maxAge;
}

/**
 * Load cached posts for files that haven't changed
 */
export function loadCachedPosts(
  cache: BuildCache,
  filePaths: string[],
): Post[] {
  const posts: Post[] = [];

  for (const filePath of filePaths) {
    const entry = cache.files[filePath];
    if (entry?.post) {
      posts.push(entry.post);
    }
  }

  return posts;
}
