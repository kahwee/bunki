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
import { generateHomePageSchemas, schemasToHtml } from "../utils/json-ld";
import { generateCollectionSchemas } from "../utils/schema-factory";
import { PAGINATION, SEO } from "../constants";

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
 * Generate an optional page from a template that may not exist.
 * Skips silently if the template is missing; warns on other errors.
 */
async function generateOptionalPage(
  templateName: string,
  context: Record<string, unknown>,
  outputDir: string,
  outputPath: string,
  label: string,
): Promise<void> {
  try {
    const html = nunjucks.render(templateName, context);
    await writeHtmlFile(outputDir, outputPath, html);
    console.log(`Generated ${label}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes(templateName)) {
      console.log(`No ${templateName} template found, skipping ${label}`);
    } else {
      console.warn(`Error generating ${label}:`, error);
    }
  }
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
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
): Promise<void> {
  const totalPages = getTotalPages(site.posts.length, pageSize);

  for (let page = 1; page <= totalPages; page++) {
    const paginatedPosts = getPaginatedItems(site.posts, page, pageSize);
    const pagination = createPagination(site.posts, page, pageSize, "/");

    // Generate JSON-LD structured data for the homepage (first page only)
    let jsonLd = "";
    if (page === 1) {
      const schemas = generateHomePageSchemas({ site: config });
      jsonLd = schemasToHtml(schemas);
    }

    const pageHtml = nunjucks.render("index.njk", {
      site: config,
      posts: paginatedPosts,
      tags: getSortedTags(site.tags, config.maxTagsOnHomepage),
      pagination,
      jsonLd,
      noindex: page > SEO.NOINDEX_AFTER_PAGE,
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
  for (let i = 0; i < site.posts.length; i += PAGINATION.BATCH_SIZE) {
    const batch = site.posts.slice(i, i + PAGINATION.BATCH_SIZE);

    await Promise.all(
      batch.map(async (post) => {
        const postPath = post.url.substring(1); // Remove leading /

        const postHtml = nunjucks.render("post.njk", {
          site: config,
          post,
          jsonLd: post.jsonLd || "",
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
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
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
      const jsonLd =
        page === 1
          ? generateCollectionSchemas(config, {
              title: tagName,
              description:
                tagData.description || `Articles tagged with ${tagName}`,
              url: `${config.baseUrl}/tags/${tagData.slug}/`,
              posts: tagData.posts,
              breadcrumbs: [
                { name: "Home", url: `${config.baseUrl}/` },
                {
                  name: tagName,
                  url: `${config.baseUrl}/tags/${tagData.slug}/`,
                },
              ],
            })
          : "";

      const tagPageHtml = nunjucks.render("tag.njk", {
        site: config,
        tag: paginatedTagData,
        tags: Object.values(site.tags),
        pagination,
        noindex: page > SEO.NOINDEX_AFTER_PAGE,
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
  pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE,
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
      const jsonLd =
        page === 1
          ? generateCollectionSchemas(config, {
              title: `Posts from ${year}`,
              description: `Articles published in ${year}`,
              url: `${config.baseUrl}/${year}/`,
              posts: yearPosts,
              breadcrumbs: [
                { name: "Home", url: `${config.baseUrl}/` },
                { name: year, url: `${config.baseUrl}/${year}/` },
              ],
            })
          : "";

      const yearPageHtml = nunjucks.render("archive.njk", {
        site: config,
        posts: paginatedPosts,
        tags: getSortedTags(site.tags, config.maxTagsOnHomepage),
        year: year,
        pagination,
        noindex: page > SEO.NOINDEX_AFTER_PAGE,
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
  await generateOptionalPage(
    "404.njk",
    { site: config },
    outputDir,
    "404.html",
    "404.html",
  );
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
  await generateOptionalPage(
    "map.njk",
    { site: config, posts: site.posts },
    outputDir,
    "map/index.html",
    "map page",
  );
}

/**
 * Generate privacy policy page (optional)
 * @param config - Site configuration
 * @param outputDir - Output directory
 */
export async function generatePrivacyPage(
  config: SiteConfig,
  outputDir: string,
): Promise<void> {
  await generateOptionalPage(
    "privacy.njk",
    { site: config },
    outputDir,
    "privacy/index.html",
    "privacy page",
  );
}
