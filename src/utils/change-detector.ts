/**
 * Change detection for incremental builds
 * Determines which files have changed and what needs to be rebuilt
 */

import type { BuildCache } from "./build-cache";
import { hasFileChanged } from "./build-cache";
import type { Post } from "../types";

export interface ChangeSet {
  /** Posts that were added or modified */
  changedPosts: string[];
  /** Posts that were deleted */
  deletedPosts: string[];
  /** Whether any CSS/style files changed */
  stylesChanged: boolean;
  /** Whether config file changed */
  configChanged: boolean;
  /** Whether template files changed */
  templatesChanged: boolean;
  /** Whether a full rebuild is required */
  fullRebuild: boolean;
}

/**
 * Detect changes since last build
 */
export async function detectChanges(
  currentFiles: string[],
  cache: BuildCache,
  options: {
    configPath?: string;
    stylesPaths?: string[];
    templatePaths?: string[];
  } = {},
): Promise<ChangeSet> {
  const changes: ChangeSet = {
    changedPosts: [],
    deletedPosts: [],
    stylesChanged: false,
    configChanged: false,
    templatesChanged: false,
    fullRebuild: false,
  };

  // Check config file
  if (options.configPath) {
    const configChanged = await hasFileChanged(options.configPath, cache);
    if (configChanged) {
      changes.configChanged = true;
      changes.fullRebuild = true;
      return changes; // Config change = full rebuild
    }
  }

  // Check template files
  if (options.templatePaths && options.templatePaths.length > 0) {
    for (const templatePath of options.templatePaths) {
      const changed = await hasFileChanged(templatePath, cache);
      if (changed) {
        changes.templatesChanged = true;
        changes.fullRebuild = true;
        return changes; // Template change = full rebuild
      }
    }
  }

  // Check style files
  if (options.stylesPaths && options.stylesPaths.length > 0) {
    for (const stylePath of options.stylesPaths) {
      const changed = await hasFileChanged(stylePath, cache);
      if (changed) {
        changes.stylesChanged = true;
        break;
      }
    }
  }

  // Check for changed posts
  for (const filePath of currentFiles) {
    const changed = await hasFileChanged(filePath, cache);
    if (changed) {
      changes.changedPosts.push(filePath);
    }
  }

  // Check for deleted posts (only check markdown files)
  const cachedFiles = Object.keys(cache.files).filter((f) => f.endsWith(".md"));
  for (const cachedFile of cachedFiles) {
    if (!currentFiles.includes(cachedFile)) {
      // File was in cache but not in current files = deleted
      changes.deletedPosts.push(cachedFile);
    }
  }

  // If posts were deleted, need to rebuild indexes/tags
  if (changes.deletedPosts.length > 0) {
    changes.fullRebuild = true;
  }

  return changes;
}

/**
 * Determine affected tags from changed posts
 */
export function getAffectedTags(
  changedPosts: Post[],
  allPosts: Post[],
): Set<string> {
  const affectedTags = new Set<string>();

  for (const post of changedPosts) {
    for (const tag of post.tags) {
      affectedTags.add(tag);
    }
  }

  return affectedTags;
}

/**
 * Check if index pages need regeneration
 */
export function needsIndexRegeneration(changes: ChangeSet): boolean {
  // Regenerate index if:
  // - Posts were added or deleted
  // - Full rebuild required
  return (
    changes.changedPosts.length > 0 ||
    changes.deletedPosts.length > 0 ||
    changes.fullRebuild
  );
}

/**
 * Estimate time saved by incremental build
 */
export function estimateTimeSaved(
  totalPosts: number,
  changedPosts: number,
): number {
  const avgTimePerPost = 6; // ms (from real-world data)
  const skippedPosts = totalPosts - changedPosts;
  return skippedPosts * avgTimePerPost;
}
