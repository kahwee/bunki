/**
 * RSS feed and sitemap generation
 */

import path from "path";
import type { Post, Site, SiteConfig, TagData } from "../types";
import { toPacificTime } from "../utils/date-utils";
import {
  escapeXml,
  buildSitemapUrl,
  calculateFreshnessPriority,
  buildRSSItem,
} from "../utils/xml-builder";
import { getTotalPages } from "../utils/pagination";

/**
 * Extract the first image URL from HTML content
 * @param html - HTML content
 * @returns First image URL or null
 */
function extractFirstImageUrl(html: string): string | null {
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/;
  const match = html.match(imgRegex);
  return match ? match[1] : null;
}

/**
 * Make image URL absolute if it's relative
 * @param imageUrl - Image URL (may be relative)
 * @param baseUrl - Base URL to prepend
 * @returns Absolute image URL
 */
function makeAbsoluteUrl(imageUrl: string, baseUrl: string): string {
  return imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`;
}

/**
 * Format date for RSS (RFC 822)
 * @param date - Date string or Date object
 * @returns RFC 822 formatted date string
 */
function formatRSSDate(date: string | Date): string {
  return toPacificTime(date).toUTCString();
}

/**
 * Generate RSS feed XML
 * @param site - Site data
 * @param config - Site configuration
 * @param outputDir - Output directory path
 * @returns RSS feed XML content
 */
export function generateRSSFeed(site: Site, config: SiteConfig): string {
  const posts = site.posts.slice(0, 15); // Latest 15 posts
  const now = toPacificTime(new Date());

  // Determine the latest post date for lastBuildDate
  const latestPostDate = posts.length > 0 ? posts[0].date : now.toISOString();
  const lastBuildDate = formatRSSDate(latestPostDate);

  // Build RSS items with full metadata
  const rssItems = posts
    .map((post) => {
      const postUrl = `${config.baseUrl}${post.url}`;
      const pubDate = formatRSSDate(post.date);

      // Extract featured image from HTML
      const featuredImage = extractFirstImageUrl(post.html);
      const absoluteImageUrl = featuredImage
        ? makeAbsoluteUrl(featuredImage, config.baseUrl)
        : null;

      // Build author string
      const author =
        config.authorEmail && config.authorName
          ? `${config.authorEmail} (${config.authorName})`
          : config.authorEmail || undefined;

      return buildRSSItem({
        title: post.title,
        link: postUrl,
        pubDate,
        description: post.excerpt,
        content: post.html,
        tags: post.tags,
        author,
        image: absoluteImageUrl,
      });
    })
    .join("\n");

  // Build channel-level metadata
  let channelXml = `  <channel>
    <title><![CDATA[${config.title}]]></title>
    <link>${config.baseUrl}/</link>
    <description><![CDATA[${config.description}]]></description>`;

  // Add language (default: en-US)
  const language = config.rssLanguage || "en-US";
  channelXml += `\n    <language>${language}</language>`;

  // Add managingEditor if configured
  if (config.authorEmail && config.authorName) {
    channelXml += `\n    <managingEditor>${config.authorEmail} (${config.authorName})</managingEditor>`;
  } else if (config.authorEmail) {
    channelXml += `\n    <managingEditor>${config.authorEmail}</managingEditor>`;
  }

  // Add webMaster if configured
  if (config.webMaster) {
    channelXml += `\n    <webMaster>${config.webMaster}</webMaster>`;
  }

  // Add copyright if configured
  if (config.copyright) {
    channelXml += `\n    <copyright><![CDATA[${config.copyright}]]></copyright>`;
  }

  // Add feed discovery links
  channelXml += `
    <pubDate>${formatRSSDate(latestPostDate)}</pubDate>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${config.baseUrl}/feed.xml" rel="self" type="application/rss+xml" />`;

  // Build final RSS document with all namespaces
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
${channelXml}
${rssItems}
  </channel>
</rss>`;
}

/**
 * Generate sitemap XML
 * @param site - Site data
 * @param config - Site configuration
 * @param pageSize - Items per page for pagination
 * @returns Sitemap XML content
 */
export function generateSitemap(
  site: Site,
  config: SiteConfig,
  pageSize: number = 10,
): string {
  const currentDate = toPacificTime(new Date()).toISOString();
  const now = toPacificTime(new Date()).getTime();

  let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Homepage
  sitemapContent += buildSitemapUrl(
    `${config.baseUrl}/`,
    currentDate,
    "daily",
    1.0,
  );

  // Homepage pagination
  const totalHomePages = getTotalPages(site.posts.length, pageSize);
  for (let page = 2; page <= totalHomePages; page++) {
    sitemapContent += buildSitemapUrl(
      `${config.baseUrl}/page/${page}/`,
      currentDate,
      "daily",
      0.8,
    );
  }

  // Individual posts
  for (const post of site.posts) {
    const postUrl = `${config.baseUrl}${post.url}`;
    const postDate = new Date(post.date).toISOString();
    const priority = calculateFreshnessPriority(post.date, 0.7, now);
    const age = now - new Date(post.date).getTime();
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    const changefreq = age < ONE_MONTH ? "weekly" : "monthly";

    sitemapContent += buildSitemapUrl(postUrl, postDate, changefreq, priority);
  }

  // Tags index
  sitemapContent += buildSitemapUrl(
    `${config.baseUrl}/tags/`,
    currentDate,
    "weekly",
    0.5,
  );

  // Map page
  sitemapContent += buildSitemapUrl(
    `${config.baseUrl}/map/`,
    currentDate,
    "weekly",
    0.6,
  );

  // Individual tag pages with pagination
  for (const [, tagData] of Object.entries(site.tags)) {
    const tagUrl = `${config.baseUrl}/tags/${tagData.slug}/`;

    // Calculate tag priority based on most recent post
    const mostRecentPost = tagData.posts[0];
    const tagPriority = mostRecentPost
      ? calculateFreshnessPriority(mostRecentPost.date, 0.4, now)
      : 0.4;

    sitemapContent += buildSitemapUrl(
      tagUrl,
      currentDate,
      "weekly",
      tagPriority,
    );

    // Tag pagination
    const totalTagPages = getTotalPages(tagData.posts.length, pageSize);
    for (let page = 2; page <= totalTagPages; page++) {
      sitemapContent += buildSitemapUrl(
        `${config.baseUrl}/tags/${tagData.slug}/page/${page}/`,
        currentDate,
        "weekly",
        Math.max(0.3, tagPriority - 0.1),
      );
    }
  }

  // Year archives with pagination
  for (const [year, yearPosts] of Object.entries(site.postsByYear)) {
    const currentYear = new Date().getFullYear();
    const isCurrentYear = parseInt(year) === currentYear;
    const yearPriority = isCurrentYear ? 0.7 : 0.5;

    sitemapContent += buildSitemapUrl(
      `${config.baseUrl}/${year}/`,
      currentDate,
      isCurrentYear ? "weekly" : "monthly",
      yearPriority,
    );

    // Year pagination
    const totalYearPages = getTotalPages(yearPosts.length, pageSize);
    for (let page = 2; page <= totalYearPages; page++) {
      sitemapContent += buildSitemapUrl(
        `${config.baseUrl}/${year}/page/${page}/`,
        currentDate,
        isCurrentYear ? "weekly" : "monthly",
        yearPriority - 0.1,
      );
    }
  }

  sitemapContent += `</urlset>`;

  return sitemapContent;
}

/**
 * Generate sitemap index XML (for large sites)
 * @param config - Site configuration
 * @returns Sitemap index XML content
 */
export function generateSitemapIndex(config: SiteConfig): string {
  const currentDate = toPacificTime(new Date()).toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${config.baseUrl}/sitemap.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`;
}

/**
 * Generate robots.txt content
 * @param config - Site configuration
 * @returns robots.txt content
 */
export function generateRobotsTxt(config: SiteConfig): string {
  return `# Robots.txt for ${config.domain}
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
}
