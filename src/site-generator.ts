/**
 * Site generator orchestrator
 * Coordinates all generation tasks using modular generators
 */

import path from "node:path";
import { FILES, PAGINATION } from "./constants";
import { copyStaticAssets, generateStylesheet } from "./generators/assets";
import {
  generateRobotsTxt,
  generateRSSFeed,
  generateSitemap,
  generateSitemapIndex,
} from "./generators/feeds";
import {
  generate404Page,
  generateIndexPages,
  generateMapPage,
  generatePostPages,
  generatePrivacyPage,
  generateTagPages,
  generateYearArchives,
} from "./generators/pages";
import { parseMarkdownDirectory, parseMarkdownFiles } from "./parser";
import { createSiteModel } from "./site-model";
import type { GeneratorOptions, Post, Site } from "./types";
import {
  type BuildCache,
  hasConfigChanged,
  hasFileChanged,
  loadCache,
  loadCachedPosts,
  saveCache,
  updateCacheEntry,
} from "./utils/build-cache";
import { displayMetrics, MetricsCollector } from "./utils/build-metrics";
import { detectChanges, estimateTimeSaved } from "./utils/change-detector";
import { ensureDir, findFilesByPattern, isDirectory } from "./utils/file-utils";
import { setNoFollowExceptions } from "./utils/markdown/parser";
import { createTemplateEngine } from "./utils/template-engine";

export class SiteGenerator {
  private options: GeneratorOptions;
  private site: Site;
  private metrics: MetricsCollector;
  private cache: BuildCache | null = null;
  private incrementalMode = false;

  constructor(options: GeneratorOptions) {
    this.options = options;
    this.site = {
      name: options.config.domain,
      posts: [],
      tags: {},
      postsByYear: {},
    };
    this.metrics = new MetricsCollector();

    // Configure template engine with custom filters
    createTemplateEngine(this.options.templatesDir);
  }

  /**
   * Enable incremental builds
   */
  enableIncrementalMode(): void {
    this.incrementalMode = true;
  }

  /**
   * Initialize site data - parse markdown and prepare site structure
   */
  async initialize(): Promise<void> {
    this.metrics.startStage("initialization");
    console.log("Initializing site generator...");

    // Fail immediately if images are placed in content/_assets/ directly.
    // Images must live in content/{year}/_assets/ — never at the content root.
    const projectRoot = this.options.rootDir ?? process.cwd();
    const flatAssetsDir = path.join(this.options.contentDir, "_assets");
    if (await isDirectory(flatAssetsDir)) {
      throw new Error(
        `Build error: content/_assets/ must not exist.\n` +
          `Images must be placed in content/{year}/_assets/ (e.g. content/2025/_assets/).\n` +
          `Move any files from content/_assets/ into the correct year folder and retry.`,
      );
    }

    await ensureDir(this.options.outputDir);

    // Set up nofollow exceptions if configured
    if (this.options.config.noFollowExceptions) {
      setNoFollowExceptions(this.options.config.noFollowExceptions);
    }

    // Load tag descriptions from tags.toml if available
    let tagDescriptions: Record<string, string> = {};
    const tagsTomlPath = path.join(projectRoot, "src", "tags.toml");

    const tagsTomlFile = Bun.file(tagsTomlPath);
    if (await tagsTomlFile.exists()) {
      try {
        const raw = Bun.TOML.parse(await tagsTomlFile.text()) as Record<string, unknown>;
        // Support both flat { tag: "desc" } and nested { tags: { tag: "desc" } } structures
        if (raw.tags && typeof raw.tags === "object" && Object.keys(raw).length === 1) {
          console.warn(
            "tags.toml uses a [tags] section header — descriptions loaded, " +
              "but consider removing the [tags] header for cleaner structure.",
          );
          tagDescriptions = raw.tags as Record<string, string>;
        } else {
          tagDescriptions = raw as Record<string, string>;
        }
        console.log(
          `Loaded ${Object.keys(tagDescriptions).length} tag descriptions from tags.toml`,
        );
      } catch (error) {
        console.warn("Error loading tag descriptions:", error);
      }
    }

    // Load cache for incremental builds
    if (this.incrementalMode) {
      this.cache = await loadCache(projectRoot);
    }

    // Parse markdown files (full or incremental)
    const posts = await this.parseContent();

    this.site = createSiteModel(posts, this.options.config, tagDescriptions);
  }

  /**
   * Generate all static site content
   */
  async generate(): Promise<void> {
    console.log("Generating static site...");

    await ensureDir(this.options.outputDir);

    // Generate stylesheet first (CSS needed for all pages)
    this.metrics.startStage("cssProcessing");

    // Check if CSS needs rebuilding
    let cssChanged = true;
    if (this.cache && this.incrementalMode && this.options.config.css) {
      const cssInputPath = path.resolve(
        this.options.rootDir ?? process.cwd(),
        this.options.config.css.input,
      );
      const cssOutputPath = path.join(this.options.outputDir, this.options.config.css.output);

      const cssOutputExists = await Bun.file(cssOutputPath).exists();
      cssChanged = await hasFileChanged(cssInputPath, this.cache);

      if (!cssChanged && cssOutputExists) {
        console.log("⏭️  Skipping CSS (unchanged)");
      } else {
        await generateStylesheet(this.options.config, this.options.outputDir);
        await updateCacheEntry(cssInputPath, this.cache);
      }
    } else {
      await generateStylesheet(this.options.config, this.options.outputDir);
    }

    // Parallelize independent page generation tasks for better performance
    this.metrics.startStage("pageGeneration");
    await Promise.all([
      generateIndexPages(this.site, this.options.config, this.options.outputDir),
      generatePostPages(this.site, this.options.config, this.options.outputDir),
      generateTagPages(this.site, this.options.config, this.options.outputDir),
      generateYearArchives(this.site, this.options.config, this.options.outputDir),
      generateMapPage(this.site, this.options.config, this.options.outputDir),
      generate404Page(this.options.config, this.options.outputDir),
      generatePrivacyPage(this.options.config, this.options.outputDir),
    ]);

    // Copy static assets
    this.metrics.startStage("assetCopying");
    await copyStaticAssets(this.options.templatesDir, this.options.outputDir);

    // Generate feeds (RSS, sitemap, robots.txt)
    this.metrics.startStage("feedGeneration");
    await this.generateFeeds();

    // Calculate output statistics and display metrics
    const outputStats = await this.calculateOutputStats();
    const buildMetrics = this.metrics.getMetrics(outputStats);
    displayMetrics(buildMetrics);

    // Save cache for incremental builds
    if (this.cache) {
      await saveCache(this.options.rootDir ?? process.cwd(), this.cache);
    }
  }

  /**
   * Generate all feed files (RSS, sitemap, robots.txt)
   */
  private async generateFeeds(): Promise<void> {
    const rssContent = generateRSSFeed(this.site, this.options.config);
    const sitemapContent = generateSitemap(
      this.site,
      this.options.config,
      PAGINATION.DEFAULT_PAGE_SIZE,
    );
    const robotsTxtContent = generateRobotsTxt(this.options.config);
    const urlCount = this.site.posts.length + Object.keys(this.site.tags).length + 10;
    const needsSitemapIndex =
      urlCount > FILES.MAX_SITEMAP_URLS || sitemapContent.length > FILES.MAX_SITEMAP_SIZE;

    const writes: Promise<number>[] = [
      Bun.write(path.join(this.options.outputDir, "feed.xml"), rssContent),
      Bun.write(path.join(this.options.outputDir, "sitemap.xml"), sitemapContent),
      Bun.write(path.join(this.options.outputDir, "robots.txt"), robotsTxtContent),
    ];

    if (needsSitemapIndex) {
      writes.push(
        Bun.write(
          path.join(this.options.outputDir, "sitemap_index.xml"),
          generateSitemapIndex(this.options.config),
        ),
      );
    }

    await Promise.all(writes);
    console.log("Generated sitemap.xml");
    console.log("Generated robots.txt");
    if (needsSitemapIndex) {
      console.log("Generated sitemap_index.xml");
    }
  }

  /**
   * Parse content (full or incremental)
   */
  private async parseContent(): Promise<Post[]> {
    const strictMode = this.options.config.strictMode ?? false;

    // Full rebuild if not in incremental mode or no cache
    if (!this.incrementalMode || !this.cache) {
      const posts = await parseMarkdownDirectory(
        this.options.contentDir,
        strictMode,
        this.options.config.cdn,
      );

      // Update cache for all files with post data
      if (this.cache) {
        const allFiles = await findFilesByPattern("**/*.md", this.options.contentDir, true);
        // Use parseMarkdownFiles to get correct filePath→post pairs.
        // posts[] is date-sorted; allFiles[] is alphabetical — index pairing
        // would map the wrong post to each file.
        const postsWithPaths = await parseMarkdownFiles(allFiles, this.options.config.cdn);
        for (const { post, filePath } of postsWithPaths) {
          await updateCacheEntry(filePath, this.cache, { post });
        }
      }

      return posts;
    }

    // Incremental build - detect changes
    const allFiles = await findFilesByPattern("**/*.md", this.options.contentDir, true);

    const configPath = path.join(this.options.rootDir ?? process.cwd(), "bunki.config.ts");
    const configChanged = await hasConfigChanged(configPath, this.cache);

    if (configChanged) {
      console.log("Config changed, full rebuild required");
      this.incrementalMode = false;
      return this.parseContent(); // Force full rebuild
    }

    const changes = await detectChanges(allFiles, this.cache);

    // Full rebuild if needed
    if (changes.fullRebuild) {
      console.log("Full rebuild required");
      this.incrementalMode = false; // Disable incremental for this build
      return this.parseContent();
    }

    // No changes detected
    if (changes.changedPosts.length === 0) {
      console.log("No content changes detected, using cached posts");
      // Load all posts from cache
      const cachedPosts = loadCachedPosts(this.cache, allFiles);
      console.log(`✨ Loaded ${cachedPosts.length} posts from cache (0ms parsing)`);
      return cachedPosts;
    }

    // Incremental build - parse only changed files
    const timeSaved = estimateTimeSaved(allFiles.length, changes.changedPosts.length);
    console.log(
      `📦 Incremental build: ${changes.changedPosts.length}/${allFiles.length} files changed ` +
        `(~${timeSaved}ms saved)`,
    );

    // Parse only changed files
    const changedPostsWithPaths = await parseMarkdownFiles(
      changes.changedPosts,
      this.options.config.cdn,
    );

    // Load cached posts for unchanged files
    const changedFiles = new Set(changes.changedPosts);
    const unchangedFiles = allFiles.filter((file) => !changedFiles.has(file));
    const cachedPosts = loadCachedPosts(this.cache, unchangedFiles);

    console.log(
      `   Parsed: ${changedPostsWithPaths.length} new/changed, ` +
        `loaded: ${cachedPosts.length} from cache`,
    );

    // Extract posts from the changed posts
    const changedPosts = changedPostsWithPaths.map((p) => p.post);

    // Merge and sort all posts by date
    const allPosts = [...changedPosts, ...cachedPosts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Update cache for changed files with post data
    for (const { post, filePath } of changedPostsWithPaths) {
      await updateCacheEntry(filePath, this.cache, { post });
    }

    return allPosts;
  }

  /**
   * Calculate output statistics (file count and total size)
   */
  private async calculateOutputStats(): Promise<{
    posts: number;
    pages: number;
    totalSize: number;
  }> {
    const outputDir = this.options.outputDir;
    let totalSize = 0;
    let pageCount = 0;

    try {
      // Use Bun.Glob to find all HTML files
      const { Glob } = await import("bun");
      const glob = new Glob("**/*.html");

      for await (const filePath of glob.scan({
        cwd: outputDir,
        absolute: true,
      })) {
        pageCount++;
        const stat = await Bun.file(filePath).stat();
        if (stat) {
          totalSize += stat.size;
        }
      }
    } catch (error) {
      // If output directory doesn't exist yet, return zeros
      console.warn("Could not calculate output stats:", error);
    }

    return {
      posts: this.site.posts.length,
      pages: pageCount,
      totalSize,
    };
  }
}
