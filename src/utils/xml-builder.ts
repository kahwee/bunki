/**
 * XML building utilities for RSS and Sitemap generation
 */

/**
 * Escape special characters in XML text to prevent CDATA issues
 * @param text - Text to escape
 * @returns Escaped XML text
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cdata(text: string): string {
  return `<![CDATA[${text.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * Build XML sitemap URL entry
 * @param loc - URL location
 * @param lastmod - Last modification date (ISO string)
 * @param changefreq - Change frequency
 * @param priority - Priority (0.0 to 1.0)
 * @returns XML string for sitemap URL entry
 */
export function buildSitemapUrl(
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: number,
): string {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>
`;
}

/**
 * Calculate priority based on content freshness
 * @param date - Content date (ISO string)
 * @param basePriority - Base priority value
 * @param now - Current time (default: Date.now())
 * @returns Adjusted priority value (0.0 to 1.0)
 */
export function calculateFreshnessPriority(
  date: string,
  basePriority: number,
  now: number = Date.now(),
): number {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;
  const ONE_MONTH = 30 * ONE_DAY;

  const postTime = new Date(date).getTime();
  const age = now - postTime;

  // Boost recent content
  if (age < ONE_WEEK) {
    return Math.min(1.0, basePriority + 0.2);
  } else if (age < ONE_MONTH) {
    return Math.min(1.0, basePriority + 0.1);
  }
  return basePriority;
}

/**
 * Build RSS item with all metadata
 * @param params - RSS item parameters
 * @returns RSS item XML string
 */
export interface RSSItemParams {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  tags?: string[];
  author?: string;
  image?: string | null;
}

export function buildRSSItem(params: RSSItemParams): string {
  const { title, link, pubDate, description, content, tags, author, image } = params;

  const categoryTags =
    tags?.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n") || "";

  let itemXml = `    <item>
      <title>${cdata(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>`;

  // Add author if provided
  if (author) {
    itemXml += `\n      <author>${escapeXml(author)}</author>`;
  }

  // Add description (with inline image if available)
  let fullDescription = description;
  if (image) {
    fullDescription = `<img src="${escapeXml(image)}" alt="" style="max-width:100%; height:auto;" /><br/><br/>${description}`;
  }
  itemXml += `\n      <description>${cdata(fullDescription)}</description>`;

  // Add categories from tags
  if (categoryTags) {
    itemXml += `\n${categoryTags}`;
  }

  // Add full content
  itemXml += `\n      <content:encoded>${cdata(content)}</content:encoded>`;

  // Add media thumbnail and enclosure if image exists
  if (image) {
    itemXml += `\n      <media:thumbnail url="${escapeXml(image)}" />`;
    itemXml += `\n      <enclosure url="${escapeXml(image)}" type="image/jpeg" length="0" />`;
  }

  itemXml += `\n    </item>`;

  return itemXml;
}
