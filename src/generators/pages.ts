/**
 * Page generation logic
 */

import nunjucks from "nunjucks";
import path from "path";
import type { Post, Site, SiteConfig, TagData } from "../types";
import { ensureDir } from "../utils/file-utils";
import {
  createPagination,
  getPaginatedItems,
  getTotalPages,
} from "../utils/pagination";
import {
  extractFirstImageUrl,
  generatePostPageSchemas,
  generateHomePageSchemas,
  generateCollectionPageSchema,
  generateBreadcrumbListSchema,
  toScriptTag,
} from "../utils/json-ld";

/**
 * Get sorted tags (by post count)
 * @param tags - Record of tag data
 * @param limit - Optional limit on number of tags
 * @returns Sorted array of TagData
 */
function getSortedTags(
  tags: Record<string, TagData>,
  limit?: number,
): TagData[] {
  const sorted = Object.values(tags).sort((a, b) => b.count - a.count);
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Write HTML file to output directory
 * @param outputDir - Base output directory
 * @param relativePath - Relative path from output dir
 * @param content - HTML content
 */
async function writeHtmlFile(
  outputDir: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = path.join(outputDir, relativePath);
  const dir = path.dirname(fullPath);
  await ensureDir(dir);
  await Bun.write(fullPath, content);
}

/**
 * Generate homepage with pagination
 * @param site - Site data
 * @param config - Site configuration
 * @param outputDir - Output directory
 * @param pageSize - Items per page
 */
export async function generateIndexPages(
  site: Site,
  config: SiteConfig,
  outputDir: string,
  pageSize: number = 10,
): Promise<void> {
  const totalPages = getTotalPages(site.posts.length, pageSize);

  for (let page = 1; page <= totalPages; page++) {
    const paginatedPosts = getPaginatedItems(site.posts, page, pageSize);
    const pagination = createPagination(site.posts, page, pageSize, "/");

    // Generate JSON-LD structured data for the homepage (first page only)
    let jsonLd = "";
    if (page === 1) {
      const schemas = generateHomePageSchemas({ site: config });
      jsonLd = schemas.map((schema) => toScriptTag(schema)).join("\n");
    }

    const pageHtml = nunjucks.render("index.njk", {
      site: config,
      posts: paginatedPosts,
      tags: getSortedTags(site.tags, config.maxTagsOnHomepage),
      pagination,
      jsonLd,
      noindex: page > 2, // Add noindex for pages beyond page 2
    });

    const outputPath = page === 1 ? "index.html" : `page/${page}/index.html`;
    await writeHtmlFile(outputDir, outputPath, pageHtml);
  }
}

/**
 * Generate individual post pages
 * @param site - Site data
 * @param config - Site configuration
 * @param outputDir - Output directory
 */
export async function generatePostPages(
  site: Site,
  config: SiteConfig,
  outputDir: string,
): Promise<void> {
  // Process posts in batches for better performance
  const batchSize = 10;
  for (let i = 0; i < site.posts.length; i += batchSize) {
    const batch = site.posts.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (post) => {
        const postPath = post.url.substring(1); // Remove leading /

        // Generate JSON-LD structured data for the post
        const imageUrl = extractFirstImageUrl(post.html, config.baseUrl);
        const schemas = generatePostPageSchemas({
          post,
          site: config,
          imageUrl,
        });
        const jsonLd = schemas.map((schema) => toScriptTag(schema)).join("\n");

        const postHtml = nunjucks.render("post.njk", {
          site: config,
          post,
          jsonLd,
        });

        await writeHtmlFile(outputDir, `${postPath}index.html`, postHtml);
      }),
    );
  }
}

/**
 * Generate tag pages with pagination
 * @param site - Site data
 * @param config - Site configuration
 * @param outputDir - Output directory
 * @param pageSize - Items per page
 */
export async function generateTagPages(
  site: Site,
  config: SiteConfig,
  outputDir: string,
  pageSize: number = 10,
): Promise<void> {
  // Generate tags index page
  const tagIndexHtml = nunjucks.render("tags.njk", {
    site: config,
    tags: getSortedTags(site.tags),
  });
  await writeHtmlFile(outputDir, "tags/index.html", tagIndexHtml);

  // Generate individual tag pages with pagination
  for (const [tagName, tagData] of Object.entries(site.tags)) {
    const totalPages = getTotalPages(tagData.posts.length, pageSize);

    for (let page = 1; page <= totalPages; page++) {
      const paginatedPosts = getPaginatedItems(tagData.posts, page, pageSize);

      const paginatedTagData = {
        ...tagData,
        posts: paginatedPosts,
      };

      const pagination = createPagination(
        tagData.posts,
        page,
        pageSize,
        `/tags/${tagData.slug}/`,
      );

      // Generate CollectionPage and BreadcrumbList schemas for first page only
      let jsonLd = "";
      if (page === 1) {
        const schemas: any[] = [];
        const description =
          tagData.description || `Articles tagged with ${tagName}`;

        // Add CollectionPage schema
        schemas.push(
          generateCollectionPageSchema({
            title: `${tagName}`,
            description: description,
            url: `${config.baseUrl}/tags/${tagData.slug}/`,
            posts: tagData.posts,
            site: config,
          }),
        );

        // Add BreadcrumbList schema
        schemas.push(
          generateBreadcrumbListSchema({
            site: config,
            items: [
              { name: "Home", url: `${config.baseUrl}/` },
              {
                name: tagName,
                url: `${config.baseUrl}/tags/${tagData.slug}/`,
              },
            ],
          }),
        );

        jsonLd = schemas.map((schema) => toScriptTag(schema)).join("\n");
      }

      const tagPageHtml = nunjucks.render("tag.njk", {
        site: config,
        tag: paginatedTagData,
        tags: Object.values(site.tags),
        pagination,
        noindex: page > 2, // Add noindex for pages beyond page 2
        jsonLd,
      });

      const outputPath =
        page === 1
          ? `tags/${tagData.slug}/index.html`
          : `tags/${tagData.slug}/page/${page}/index.html`;

      await writeHtmlFile(outputDir, outputPath, tagPageHtml);
    }
  }
}

/**
 * Generate year archive pages with pagination
 * @param site - Site data
 * @param config - Site configuration
 * @param outputDir - Output directory
 * @param pageSize - Items per page
 */
export async function generateYearArchives(
  site: Site,
  config: SiteConfig,
  outputDir: string,
  pageSize: number = 10,
): Promise<void> {
  for (const [year, yearPosts] of Object.entries(site.postsByYear)) {
    const totalPages = getTotalPages(yearPosts.length, pageSize);

    for (let page = 1; page <= totalPages; page++) {
      const paginatedPosts = getPaginatedItems(yearPosts, page, pageSize);
      const pagination = createPagination(
        yearPosts,
        page,
        pageSize,
        `/${year}/`,
      );

      // Generate CollectionPage and BreadcrumbList schemas for first page only
      let jsonLd = "";
      if (page === 1) {
        const schemas: any[] = [];

        // Add CollectionPage schema
        schemas.push(
          generateCollectionPageSchema({
            title: `Posts from ${year}`,
            description: `Articles published in ${year}`,
            url: `${config.baseUrl}/${year}/`,
            posts: yearPosts,
            site: config,
          }),
        );

        // Add BreadcrumbList schema
        schemas.push(
          generateBreadcrumbListSchema({
            site: config,
            items: [
              { name: "Home", url: `${config.baseUrl}/` },
              { name: year, url: `${config.baseUrl}/${year}/` },
            ],
          }),
        );

        jsonLd = schemas.map((schema) => toScriptTag(schema)).join("\n");
      }

      const yearPageHtml = nunjucks.render("archive.njk", {
        site: config,
        posts: paginatedPosts,
        tags: getSortedTags(site.tags, config.maxTagsOnHomepage),
        year: year,
        pagination,
        noindex: page > 2, // Add noindex for pages beyond page 2
        jsonLd,
      });

      const outputPath =
        page === 1 ? `${year}/index.html` : `${year}/page/${page}/index.html`;

      await writeHtmlFile(outputDir, outputPath, yearPageHtml);
    }
  }
}

/**
 * Generate 404 error page (optional)
 * @param config - Site configuration
 * @param outputDir - Output directory
 */
export async function generate404Page(
  config: SiteConfig,
  outputDir: string,
): Promise<void> {
  try {
    const notFoundHtml = nunjucks.render("404.njk", {
      site: config,
    });

    await writeHtmlFile(outputDir, "404.html", notFoundHtml);
    console.log("Generated 404.html");
  } catch (error) {
    // If 404.njk template doesn't exist, skip generation silently
    if (error instanceof Error && error.message.includes("404.njk")) {
      console.log("No 404.njk template found, skipping 404 page generation");
    } else {
      console.warn("Error generating 404 page:", error);
    }
  }
}

/**
 * Generate map page (optional)
 * @param site - Site data
 * @param config - Site configuration
 * @param outputDir - Output directory
 */
export async function generateMapPage(
  site: Site,
  config: SiteConfig,
  outputDir: string,
): Promise<void> {
  try {
    const mapHtml = nunjucks.render("map.njk", {
      site: config,
      posts: site.posts,
    });

    await writeHtmlFile(outputDir, "map/index.html", mapHtml);
    console.log("Generated map page");
  } catch (error) {
    // If map.njk template doesn't exist, skip generation silently
    if (error instanceof Error && error.message.includes("map.njk")) {
      console.log("No map.njk template found, skipping map page generation");
    } else {
      console.warn("Error generating map page:", error);
    }
  }
}
