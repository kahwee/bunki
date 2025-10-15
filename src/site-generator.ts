import { Glob } from "bun";
import fs from "fs";
import nunjucks from "nunjucks";
import path from "path";
import slugify from "slugify";
import { parseMarkdownDirectory } from "./parser";
import { GeneratorOptions, PaginationData, Post, Site, TagData } from "./types";
import { getDefaultCSSConfig, processCSS } from "./utils/css-processor";
import { copyFile, ensureDir } from "./utils/file-utils";

export class SiteGenerator {
  private options: GeneratorOptions;
  private site: Site;

  private formatRSSDate(date: string): string {
    const pacificDate = new Date(
      new Date(date).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
      }),
    );
    return pacificDate.toUTCString();
  }

  private getPacificDate(date: string | Date): Date {
    return new Date(
      new Date(date).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
      }),
    );
  }

  private createPagination(
    items: any[],
    currentPage: number,
    pageSize: number,
    pagePath: string,
  ): PaginationData {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      pageSize,
      totalItems,
      pagePath,
    };
  }

  constructor(options: GeneratorOptions) {
    this.options = options;
    this.site = {
      name: options.config.domain,
      posts: [],
      tags: {},
    };

    const env = nunjucks.configure(this.options.templatesDir, {
      autoescape: true,
      watch: false,
    });

    env.addFilter("date", function (date, format) {
      const pstDate = new Date(date).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
      });
      const d = new Date(pstDate);
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

  async initialize(): Promise<void> {
    console.log("Initializing site generator...");

    await ensureDir(this.options.outputDir);

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

    const posts = await parseMarkdownDirectory(this.options.contentDir);
    console.log(`Parsed ${posts.length} posts`);

    const tags: Record<string, TagData> = {};

    posts.forEach((post) => {
      post.tagSlugs = {};

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
    };
  }

  async generate(): Promise<void> {
    console.log("Generating static site...");

    await ensureDir(this.options.outputDir);
    await this.generateStylesheet();
    await this.generateIndexPage();
    await this.generatePostPages();
    await this.generateTagPages();
    await this.generateYearArchives();
    await this.generateRSSFeed();
    await this.generateSitemap();
    await this.generateRobotsTxt();
    await this.copyStaticAssets();

    console.log("Site generation complete!");
  }

  private async generateYearArchives(): Promise<void> {
    const postsByYear: Record<string, Post[]> = {};

    for (const post of this.site.posts) {
      const postDate = new Date(post.date);
      const year = postDate.getFullYear().toString();

      if (!postsByYear[year]) {
        postsByYear[year] = [];
      }

      postsByYear[year].push(post);
    }

    for (const [year, yearPosts] of Object.entries(postsByYear)) {
      const yearDir = path.join(this.options.outputDir, year);
      await ensureDir(yearDir);

      const pageSize = 10;
      const totalPages = Math.ceil(yearPosts.length / pageSize);

      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPosts = yearPosts.slice(startIndex, endIndex);

        const pagination = this.createPagination(
          yearPosts,
          page,
          pageSize,
          `/${year}/`,
        );

        const yearPageHtml = nunjucks.render("archive.njk", {
          site: this.options.config,
          posts: paginatedPosts,
          tags: Object.values(this.site.tags),
          year: year,
          pagination,
        });

        if (page === 1) {
          await Bun.write(path.join(yearDir, "index.html"), yearPageHtml);
        } else {
          const pageDir = path.join(yearDir, "page", page.toString());
          await ensureDir(pageDir);
          await Bun.write(path.join(pageDir, "index.html"), yearPageHtml);
        }
      }
    }
  }

  private async generateIndexPage(): Promise<void> {
    const pageSize = 10;
    const totalPages = Math.ceil(this.site.posts.length / pageSize);

    for (let page = 1; page <= totalPages; page++) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedPosts = this.site.posts.slice(startIndex, endIndex);

      const pagination = this.createPagination(
        this.site.posts,
        page,
        pageSize,
        "/",
      );

      const pageHtml = nunjucks.render("index.njk", {
        site: this.options.config,
        posts: paginatedPosts,
        tags: Object.values(this.site.tags),
        pagination,
      });

      if (page === 1) {
        await Bun.write(
          path.join(this.options.outputDir, "index.html"),
          pageHtml,
        );
      } else {
        const pageDir = path.join(
          this.options.outputDir,
          "page",
          page.toString(),
        );
        await ensureDir(pageDir);
        await Bun.write(path.join(pageDir, "index.html"), pageHtml);
      }
    }
  }

  private async generatePostPages(): Promise<void> {
    for (const post of this.site.posts) {
      const postPath = post.url.substring(1);
      const postDir = path.join(this.options.outputDir, postPath);

      await ensureDir(postDir);

      const postHtml = nunjucks.render("post.njk", {
        site: this.options.config,
        post,
        tags: Object.values(this.site.tags),
      });

      await Bun.write(path.join(postDir, "index.html"), postHtml);
    }
  }

  private async generateTagPages(): Promise<void> {
    const tagsDir = path.join(this.options.outputDir, "tags");
    await ensureDir(tagsDir);

    const tagIndexHtml = nunjucks.render("tags.njk", {
      site: this.options.config,
      tags: Object.values(this.site.tags),
    });

    await Bun.write(path.join(tagsDir, "index.html"), tagIndexHtml);

    for (const [tagName, tagData] of Object.entries(this.site.tags)) {
      const tagDir = path.join(tagsDir, tagData.slug);
      await ensureDir(tagDir);

      const pageSize = 10;
      const totalPages = Math.ceil(tagData.posts.length / pageSize);

      for (let page = 1; page <= totalPages; page++) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPosts = tagData.posts.slice(startIndex, endIndex);

        const paginatedTagData = {
          ...tagData,
          posts: paginatedPosts,
        };

        const pagination = this.createPagination(
          tagData.posts,
          page,
          pageSize,
          `/tags/${tagData.slug}/`,
        );

        const tagPageHtml = nunjucks.render("tag.njk", {
          site: this.options.config,
          tag: paginatedTagData,
          tags: Object.values(this.site.tags),
          pagination,
        });

        if (page === 1) {
          await Bun.write(path.join(tagDir, "index.html"), tagPageHtml);
        } else {
          const pageDir = path.join(tagDir, "page", page.toString());
          await ensureDir(pageDir);
          await Bun.write(path.join(pageDir, "index.html"), tagPageHtml);
        }
      }
    }
  }

  private async generateStylesheet(): Promise<void> {
    // Use CSS configuration from site config, or fallback to default
    const cssConfig = this.options.config.css || getDefaultCSSConfig();

    if (!cssConfig.enabled) {
      console.log(
        "CSS processing is disabled, skipping stylesheet generation.",
      );
      return;
    }

    try {
      await processCSS({
        css: cssConfig,
        projectRoot: process.cwd(),
        outputDir: this.options.outputDir,
        verbose: true,
      });
    } catch (error) {
      console.error("Error processing CSS:", error);

      // Fallback to simple file copying if PostCSS fails
      console.log("Falling back to simple CSS file copying...");
      await this.fallbackCSSGeneration(cssConfig);
    }
  }

  private async fallbackCSSGeneration(cssConfig: any): Promise<void> {
    const cssFilePath = path.resolve(process.cwd(), cssConfig.input);
    const cssFile = Bun.file(cssFilePath);

    if (!(await cssFile.exists())) {
      console.warn(`CSS input file not found: ${cssFilePath}`);
      return;
    }

    try {
      const cssContent = await cssFile.text();
      const outputPath = path.resolve(this.options.outputDir, cssConfig.output);
      const outputDir = path.dirname(outputPath);

      await ensureDir(outputDir);
      await Bun.write(outputPath, cssContent);

      console.log("✅ CSS file copied successfully (fallback mode)");
    } catch (error) {
      console.error("Error in fallback CSS generation:", error);
    }
  }

  private async copyStaticAssets(): Promise<void> {
    const assetsDir = path.join(this.options.templatesDir, "assets");
    const publicDir = path.join(process.cwd(), "public");
    // Helper: robust directory existence check (Bun.file() can be unreliable for dirs)
    async function dirExists(p: string): Promise<boolean> {
      try {
        const stat = await fs.promises.stat(p);
        return stat.isDirectory();
      } catch {
        return false;
      }
    }

    const assetsDirFile = Bun.file(assetsDir); // keep existing logic for assets (optional)
    if ((await assetsDirFile.exists()) && (await dirExists(assetsDir))) {
      const assetGlob = new Glob("**/*.*");
      const assetsOutputDir = path.join(this.options.outputDir, "assets");

      await ensureDir(assetsOutputDir);

      for await (const file of assetGlob.scan({
        cwd: assetsDir,
        absolute: true,
      })) {
        const relativePath = path.relative(assetsDir, file);
        const targetPath = path.join(assetsOutputDir, relativePath);

        const targetDir = path.dirname(targetPath);
        await ensureDir(targetDir);

        await copyFile(file, targetPath);
      }
    }

    if (await dirExists(publicDir)) {
      // Recursively traverse public directory to include files without extensions and dotfiles
      const copyRecursive = async (srcDir: string) => {
        const entries = await fs.promises.readdir(srcDir, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry.name);
          const relativePath = path.relative(publicDir, srcPath);
          const destPath = path.join(this.options.outputDir, relativePath);

          // Skip if this is the root directory itself
          if (!relativePath) continue;

          if (entry.isDirectory()) {
            await ensureDir(destPath);
            await copyRecursive(srcPath);
          } else if (entry.isFile()) {
            const targetFile = Bun.file(destPath);
            if (!(await targetFile.exists())) {
              const targetDir = path.dirname(destPath);
              await ensureDir(targetDir);
              await copyFile(srcPath, destPath);
            }
          }
        }
      };
      await copyRecursive(publicDir);
      console.log(
        "Copied public files to site (including extensionless & dotfiles)",
      );
    }
  }

  private async generateRSSFeed(): Promise<void> {
    const posts = this.site.posts.slice(0, 15);
    const config = this.options.config;

    const rssItems = posts
      .map((post) => {
        const postUrl = `${config.baseUrl}${post.url}`;
        const pubDate = this.formatRSSDate(post.date);

        return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
    </item>`;
      })
      .join("\n");

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${config.title}]]></title>
    <description><![CDATA[${config.description}]]></description>
    <link>${config.baseUrl}</link>
    <atom:link href="${config.baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${this.formatRSSDate(this.getPacificDate(new Date()).toISOString())}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;

    await Bun.write(path.join(this.options.outputDir, "feed.xml"), rssContent);
  }

  private async generateSitemap(): Promise<void> {
    const currentDate = this.getPacificDate(new Date()).toISOString();
    const pageSize = 10;
    const config = this.options.config;
    const now = this.getPacificDate(new Date()).getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ONE_WEEK = 7 * ONE_DAY;
    const ONE_MONTH = 30 * ONE_DAY;

    // Helper function to calculate priority based on freshness
    const calculatePriority = (date: string, basePriority: number): number => {
      const postTime = new Date(date).getTime();
      const age = now - postTime;

      // Boost recent content
      if (age < ONE_WEEK) {
        return Math.min(1.0, basePriority + 0.2);
      } else if (age < ONE_MONTH) {
        return Math.min(1.0, basePriority + 0.1);
      }
      return basePriority;
    };

    let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    sitemapContent += `  <url>
    <loc>${config.baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

    const totalHomePages = Math.ceil(this.site.posts.length / pageSize);
    if (totalHomePages > 1) {
      for (let page = 2; page <= totalHomePages; page++) {
        sitemapContent += `  <url>
    <loc>${config.baseUrl}/page/${page}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
      }
    }

    for (const post of this.site.posts) {
      const postUrl = `${config.baseUrl}${post.url}`;
      const postDate = new Date(post.date).toISOString();
      const priority = calculatePriority(post.date, 0.7);
      const age = now - new Date(post.date).getTime();
      const changefreq = age < ONE_MONTH ? "weekly" : "monthly";

      sitemapContent += `  <url>
    <loc>${postUrl}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>
`;
    }

    sitemapContent += `  <url>
    <loc>${config.baseUrl}/tags/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;

    for (const [, tagData] of Object.entries(this.site.tags)) {
      const tagUrl = `${config.baseUrl}/tags/${tagData.slug}/`;
      // Calculate tag priority based on most recent post
      const mostRecentPost = tagData.posts[0];
      const tagPriority = mostRecentPost
        ? calculatePriority(mostRecentPost.date, 0.4)
        : 0.4;

      sitemapContent += `  <url>
    <loc>${tagUrl}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${tagPriority.toFixed(1)}</priority>
  </url>
`;

      const totalTagPages = Math.ceil(tagData.posts.length / pageSize);
      if (totalTagPages > 1) {
        for (let page = 2; page <= totalTagPages; page++) {
          sitemapContent += `  <url>
    <loc>${config.baseUrl}/tags/${tagData.slug}/page/${page}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${Math.max(0.3, tagPriority - 0.1).toFixed(1)}</priority>
  </url>
`;
        }
      }
    }

    const postsByYear: Record<string, Post[]> = {};
    for (const post of this.site.posts) {
      const postDate = new Date(post.date);
      const year = postDate.getFullYear().toString();

      if (!postsByYear[year]) {
        postsByYear[year] = [];
      }

      postsByYear[year].push(post);
    }

    for (const [year, yearPosts] of Object.entries(postsByYear)) {
      const currentYear = new Date().getFullYear();
      const isCurrentYear = parseInt(year) === currentYear;
      const yearPriority = isCurrentYear ? 0.7 : 0.5;

      sitemapContent += `  <url>
    <loc>${config.baseUrl}/${year}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${isCurrentYear ? 'weekly' : 'monthly'}</changefreq>
    <priority>${yearPriority.toFixed(1)}</priority>
  </url>
`;

      const totalYearPages = Math.ceil(yearPosts.length / pageSize);
      if (totalYearPages > 1) {
        for (let page = 2; page <= totalYearPages; page++) {
          sitemapContent += `  <url>
    <loc>${config.baseUrl}/${year}/page/${page}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${isCurrentYear ? 'weekly' : 'monthly'}</changefreq>
    <priority>${(yearPriority - 0.1).toFixed(1)}</priority>
  </url>
`;
        }
      }
    }

    sitemapContent += `</urlset>`;

    await Bun.write(
      path.join(this.options.outputDir, "sitemap.xml"),
      sitemapContent,
    );
    console.log("Generated sitemap.xml");

    // Generate sitemap index if content is large (> 40KB or > 1000 URLs)
    const urlCount = this.site.posts.length + Object.keys(this.site.tags).length + 10; // rough estimate
    const sitemapSize = sitemapContent.length;

    if (urlCount > 1000 || sitemapSize > 40000) {
      await this.generateSitemapIndex();
    }
  }

  private async generateSitemapIndex(): Promise<void> {
    const currentDate = this.getPacificDate(new Date()).toISOString();
    const config = this.options.config;

    let sitemapIndexContent = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Main sitemap
    sitemapIndexContent += `  <sitemap>
    <loc>${config.baseUrl}/sitemap.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
`;

    // You can add additional sitemaps here if needed (e.g., images, videos)
    // For now, we'll just reference the main sitemap

    sitemapIndexContent += `</sitemapindex>`;

    await Bun.write(
      path.join(this.options.outputDir, "sitemap_index.xml"),
      sitemapIndexContent,
    );
    console.log("Generated sitemap_index.xml");
  }

  private async generateRobotsTxt(): Promise<void> {
    const config = this.options.config;

    const robotsTxtContent = `# Robots.txt for ${config.domain}
# Generated by Bunki

User-agent: *
Allow: /

# Sitemaps
Sitemap: ${config.baseUrl}/sitemap.xml

# Crawl-delay (optional, adjust as needed)
# Crawl-delay: 1

# Disallow specific paths (uncomment as needed)
# Disallow: /private/
# Disallow: /admin/
# Disallow: /api/
`;

    await Bun.write(
      path.join(this.options.outputDir, "robots.txt"),
      robotsTxtContent,
    );
    console.log("Generated robots.txt");
  }
}
