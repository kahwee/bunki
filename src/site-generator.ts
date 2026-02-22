/**
 * Site generator orchestrator
 * Coordinates all generation tasks using modular generators
 */

import nunjucks from "nunjucks";
import path from "path";
import slugify from "slugify";
import { parseMarkdownDirectory } from "./parser";
import type { GeneratorOptions, Post, Site, TagData } from "./types";
import { toPacificTime, getPacificYear } from "./utils/date-utils";
import { ensureDir } from "./utils/file-utils";
import { setNoFollowExceptions } from "./utils/markdown/parser";
import { extractFirstImageUrl } from "./utils/json-ld";
import {
  generateRSSFeed,
  generateSitemap,
  generateSitemapIndex,
  generateRobotsTxt,
} from "./generators/feeds";
import {
  generateIndexPages,
  generatePostPages,
  generateTagPages,
  generateYearArchives,
  generate404Page,
  generateMapPage,
} from "./generators/pages";
import { generateStylesheet, copyStaticAssets } from "./generators/assets";
import { getTotalPages } from "./utils/pagination";
import {
  MetricsCollector,
  displayMetrics,
  type BuildMetrics,
} from "./utils/build-metrics";

export class SiteGenerator {
  private options: GeneratorOptions;
  private site: Site;
  private metrics: MetricsCollector;

  constructor(options: GeneratorOptions) {
    this.options = options;
    this.site = {
      name: options.config.domain,
      posts: [],
      tags: {},
      postsByYear: {},
    };
    this.metrics = new MetricsCollector();

    // Configure Nunjucks with custom filters and template caching
    const env = nunjucks.configure(this.options.templatesDir, {
      autoescape: true,
      watch: false,
      noCache: false, // Enable template caching for better performance
    });

    // Add date filter
    env.addFilter("date", (date, format) => {
      const d = toPacificTime(date);
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      if (format === "YYYY") {
        return d.getFullYear();
      } else if (format === "MMMM D, YYYY") {
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      } else if (format === "MMMM D, YYYY h:mm A") {
        const hours = d.getHours() % 12 || 12;
        const ampm = d.getHours() >= 12 ? "PM" : "AM";
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} @ ${hours} ${ampm}`;
      } else {
        return d.toLocaleDateString("en-US", {
          timeZone: "America/Los_Angeles",
        });
      }
    });
  }

  /**
   * Initialize site data - parse markdown and prepare site structure
   */
  async initialize(): Promise<void> {
    this.metrics.startStage("initialization");
    console.log("Initializing site generator...");

    await ensureDir(this.options.outputDir);

    // Set up nofollow exceptions if configured
    if (this.options.config.noFollowExceptions) {
      setNoFollowExceptions(this.options.config.noFollowExceptions);
    }

    // Load tag descriptions from tags.toml if available
    let tagDescriptions: Record<string, string> = {};
    const tagsTomlPath = path.join(process.cwd(), "src", "tags.toml");

    const tagsTomlFile = Bun.file(tagsTomlPath);
    if (await tagsTomlFile.exists()) {
      try {
        tagDescriptions = require(tagsTomlPath);
        console.log("Loaded tag descriptions from tags.toml");
      } catch (error) {
        console.warn("Error loading tag descriptions:", error);
      }
    }

    // Parse markdown files
    const strictMode = this.options.config.strictMode ?? false;
    const posts = await parseMarkdownDirectory(
      this.options.contentDir,
      strictMode,
      this.options.config.cdn,
    );

    // Build tags and process posts
    const tags: Record<string, TagData> = {};

    posts.forEach((post) => {
      post.tagSlugs = {};

      // Extract first image URL from post content for thumbnail/social sharing
      const imageUrl = extractFirstImageUrl(
        post.html,
        this.options.config.baseUrl,
      );
      if (imageUrl) {
        post.image = imageUrl;
      }

      post.tags.forEach((tagName) => {
        const tagSlug = slugify(tagName, { lower: true, strict: true });
        post.tagSlugs[tagName] = tagSlug;

        if (!tags[tagName]) {
          const tagData: TagData = {
            name: tagName,
            slug: tagSlug,
            count: 0,
            posts: [],
          };

          if (tagDescriptions[tagName.toLowerCase()]) {
            tagData.description = tagDescriptions[tagName.toLowerCase()];
          }

          tags[tagName] = tagData;
        }

        tags[tagName].count += 1;
        tags[tagName].posts.push(post);
      });
    });

    this.site = {
      name: this.options.config.domain,
      posts,
      tags,
      postsByYear: this.groupPostsByYear(posts),
    };
  }

  /**
   * Generate all static site content
   */
  async generate(): Promise<void> {
    console.log("Generating static site...");

    await ensureDir(this.options.outputDir);

    // Generate stylesheet first (CSS needed for all pages)
    this.metrics.startStage("cssProcessing");
    await generateStylesheet(this.options.config, this.options.outputDir);

    // Parallelize independent page generation tasks for better performance
    this.metrics.startStage("pageGeneration");
    await Promise.all([
      generateIndexPages(
        this.site,
        this.options.config,
        this.options.outputDir,
      ),
      generatePostPages(this.site, this.options.config, this.options.outputDir),
      generateTagPages(this.site, this.options.config, this.options.outputDir),
      generateYearArchives(
        this.site,
        this.options.config,
        this.options.outputDir,
      ),
      generateMapPage(this.site, this.options.config, this.options.outputDir),
      generate404Page(this.options.config, this.options.outputDir),
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
  }

  /**
   * Generate all feed files (RSS, sitemap, robots.txt)
   */
  private async generateFeeds(): Promise<void> {
    const pageSize = 10;

    // Generate RSS feed
    const rssContent = generateRSSFeed(this.site, this.options.config);
    await Bun.write(path.join(this.options.outputDir, "feed.xml"), rssContent);

    // Generate sitemap
    const sitemapContent = generateSitemap(
      this.site,
      this.options.config,
      pageSize,
    );
    await Bun.write(
      path.join(this.options.outputDir, "sitemap.xml"),
      sitemapContent,
    );
    console.log("Generated sitemap.xml");

    // Generate sitemap index if content is large (> 40KB or > 1000 URLs)
    const urlCount =
      this.site.posts.length + Object.keys(this.site.tags).length + 10; // rough estimate
    const sitemapSize = sitemapContent.length;

    if (urlCount > 1000 || sitemapSize > 40000) {
      const sitemapIndexContent = generateSitemapIndex(this.options.config);
      await Bun.write(
        path.join(this.options.outputDir, "sitemap_index.xml"),
        sitemapIndexContent,
      );
      console.log("Generated sitemap_index.xml");
    }

    // Generate robots.txt
    const robotsTxtContent = generateRobotsTxt(this.options.config);
    await Bun.write(
      path.join(this.options.outputDir, "robots.txt"),
      robotsTxtContent,
    );
    console.log("Generated robots.txt");
  }

  /**
   * Group posts by year (Pacific timezone)
   * @param posts - Array of posts
   * @returns Posts grouped by year
   */
  private groupPostsByYear(posts: Post[]): Record<string, Post[]> {
    const postsByYear: Record<string, Post[]> = {};

    for (const post of posts) {
      const year = getPacificYear(post.date).toString();

      if (!postsByYear[year]) {
        postsByYear[year] = [];
      }

      postsByYear[year].push(post);
    }

    return postsByYear;
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
