/**
 * JSON-LD (JavaScript Object Notation for Linked Data) utility functions
 * for generating structured data markup for SEO optimization.
 *
 * This module provides functions to generate Schema.org structured data
 * in JSON-LD format, which helps search engines better understand your content.
 *
 * Supported schema types:
 * - BlogPosting: For individual blog posts/articles
 * - WebSite: For the homepage/website metadata
 * - BreadcrumbList: For navigation breadcrumbs
 * - Organization: For publisher/organization information
 * - Person: For author information
 *
 * @see https://schema.org/
 * @see https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 */

import type { Post, SiteConfig } from "../types.js";

/**
 * Base Schema.org Thing type
 */
interface SchemaOrgThing {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: any;
}

/**
 * Options for generating BlogPosting JSON-LD
 */
export interface BlogPostingOptions {
  /** The post object */
  post: Post;
  /** Site configuration */
  site: SiteConfig;
  /** Optional image URL for the post (first image extracted from content) */
  imageUrl?: string;
  /** Optional date modified (defaults to date published) */
  dateModified?: string;
}

/**
 * Options for generating WebSite JSON-LD
 */
export interface WebSiteOptions {
  /** Site configuration */
  site: SiteConfig;
}

/**
 * Options for generating BreadcrumbList JSON-LD
 */
export interface BreadcrumbListOptions {
  /** Site configuration */
  site: SiteConfig;
  /** Current post (optional, for post pages) */
  post?: Post;
  /** Custom breadcrumb items */
  items?: Array<{ name: string; url: string }>;
}

/**
 * Options for generating CollectionPage JSON-LD
 */
export interface CollectionPageOptions {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Page URL */
  url: string;
  /** Posts to include in the collection */
  posts: Post[];
  /** Site configuration */
  site: SiteConfig;
}

/**
 * Generates a Person schema for author information
 *
 * @param name - Author's name
 * @param email - Author's email (optional)
 * @returns Person schema object
 *
 * @example
 * const author = generatePersonSchema("John Doe", "john@example.com");
 * // Returns: { "@type": "Person", "name": "John Doe", "email": "john@example.com" }
 */
export function generatePersonSchema(
  name: string,
  email?: string,
): SchemaOrgThing {
  const person: SchemaOrgThing = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
  };

  if (email) {
    person.email = email;
  }

  return person;
}

/**
 * Generates an Organization schema for publisher information
 *
 * @param site - Site configuration
 * @returns Organization schema object
 *
 * @example
 * const org = generateOrganizationSchema({ title: "My Blog", baseUrl: "https://example.com" });
 * // Returns: { "@type": "Organization", "name": "My Blog", "url": "https://example.com" }
 */
export function generateOrganizationSchema(site: SiteConfig): SchemaOrgThing {
  const organization: SchemaOrgThing = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.title,
    url: `${site.baseUrl}/`,
  };

  if (site.description) {
    organization.description = site.description;
  }

  return organization;
}

/**
 * Generates BlogPosting structured data for a blog post
 *
 * This is the primary schema for individual blog posts/articles.
 * It provides search engines with detailed information about the post
 * including title, author, publication date, content, and more.
 *
 * @param options - BlogPosting generation options
 * @returns BlogPosting schema as JSON-LD object
 *
 * @example
 * const jsonLd = generateBlogPostingSchema({
 *   post: { title: "Hello World", date: "2025-01-15T10:00:00Z", ... },
 *   site: { title: "My Blog", baseUrl: "https://example.com", ... }
 * });
 *
 * @see https://schema.org/BlogPosting
 */
export function generateBlogPostingSchema(
  options: BlogPostingOptions,
): SchemaOrgThing {
  const { post, site, imageUrl, dateModified } = options;
  const postUrl = `${site.baseUrl}${post.url}`;

  const blogPosting: SchemaOrgThing = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: postUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    datePublished: post.date,
    dateModified: dateModified || post.date,
  };

  // Add author if available
  if (site.authorName) {
    blogPosting.author = {
      "@type": "Person",
      name: site.authorName,
      ...(site.authorEmail && { email: site.authorEmail }),
    };
  }

  // Add publisher (organization or person)
  blogPosting.publisher = {
    "@type": "Organization",
    name: site.title,
    url: `${site.baseUrl}/`,
  };

  // Add image if available
  if (imageUrl) {
    blogPosting.image = imageUrl;
  }

  // Add keywords from tags
  if (post.tags && post.tags.length > 0) {
    blogPosting.keywords = post.tags.join(", ");
  }

  // Add article section/category based on primary tag
  if (post.tags && post.tags.length > 0) {
    blogPosting.articleSection = post.tags[0];
  }

  // Add word count (approximate from content length)
  if (post.content) {
    const wordCount = post.content.split(/\s+/).length;
    blogPosting.wordCount = wordCount;
  }

  // Add in language (defaults to English)
  blogPosting.inLanguage = site.rssLanguage || "en-US";

  return blogPosting;
}

/**
 * Generates WebSite structured data for the homepage
 *
 * This schema provides search engines with information about the website
 * itself, including name, description, and URL.
 *
 * @param options - WebSite generation options
 * @returns WebSite schema as JSON-LD object
 *
 * @example
 * const jsonLd = generateWebSiteSchema({
 *   site: { title: "My Blog", baseUrl: "https://example.com", description: "..." }
 * });
 *
 * @see https://schema.org/WebSite
 */
export function generateWebSiteSchema(options: WebSiteOptions): SchemaOrgThing {
  const { site } = options;

  const webSite: SchemaOrgThing = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    url: `${site.baseUrl}/`,
  };

  if (site.description) {
    webSite.description = site.description;
  }

  // Add potential action for search functionality if applicable
  // This can be customized if the site has a search feature
  webSite.potentialAction = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${site.baseUrl}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  };

  return webSite;
}

/**
 * Generates BreadcrumbList structured data for navigation
 *
 * Breadcrumbs help search engines understand the site's hierarchy
 * and can appear in search results.
 *
 * @param options - BreadcrumbList generation options
 * @returns BreadcrumbList schema as JSON-LD object
 *
 * @example
 * // For a blog post
 * const jsonLd = generateBreadcrumbListSchema({
 *   site: { title: "My Blog", baseUrl: "https://example.com" },
 *   post: { title: "Hello World", url: "/2025/hello-world/" }
 * });
 *
 * @see https://schema.org/BreadcrumbList
 */
export function generateBreadcrumbListSchema(
  options: BreadcrumbListOptions,
): SchemaOrgThing {
  const { site, post, items } = options;

  const breadcrumbs: SchemaOrgThing = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [],
  };

  // Use custom items if provided
  if (items && items.length > 0) {
    breadcrumbs.itemListElement = items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    }));
    return breadcrumbs;
  }

  // Generate breadcrumbs for homepage
  const homeItem = {
    "@type": "ListItem",
    position: 1,
    name: "Home",
    item: `${site.baseUrl}/`,
  };

  breadcrumbs.itemListElement.push(homeItem);

  // Add post breadcrumb if on a post page
  if (post) {
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      position: 2,
      name: post.title,
      item: `${site.baseUrl}${post.url}`,
    });
  }

  return breadcrumbs;
}

/**
 * Generates CollectionPage structured data for archive and tag pages
 *
 * This schema helps search engines understand that a page contains a collection
 * of blog posts, improving indexing of archive, tag, and category pages.
 *
 * @param options - CollectionPage generation options
 * @returns CollectionPage schema as JSON-LD object
 *
 * @example
 * const jsonLd = generateCollectionPageSchema({
 *   title: "Posts from 2025",
 *   description: "All articles published in 2025",
 *   url: "https://example.com/2025/",
 *   posts: [...],
 *   site: { title: "My Blog", baseUrl: "https://example.com" }
 * });
 *
 * @see https://schema.org/CollectionPage
 */
export function generateCollectionPageSchema(
  options: CollectionPageOptions,
): SchemaOrgThing {
  const { title, description, url, posts, site } = options;

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: description,
    url: url,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.slice(0, 10).map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${site.baseUrl}${post.url}`,
      })),
    },
  };
}

/**
 * Converts a JSON-LD object to an HTML script tag string
 *
 * This helper function serializes the JSON-LD object and wraps it
 * in a script tag for inclusion in HTML templates.
 *
 * @param jsonLd - The JSON-LD object to convert
 * @returns HTML script tag string
 *
 * @example
 * const schema = generateBlogPostingSchema({ ... });
 * const scriptTag = toScriptTag(schema);
 * // Returns: '<script type="application/ld+json">{"@context":"https://schema.org",...}</script>'
 */
export function toScriptTag(jsonLd: SchemaOrgThing): string {
  // Use JSON.stringify with 2-space indentation for readability
  const json = JSON.stringify(jsonLd, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/**
 * Extracts the first image URL from HTML content
 *
 * Searches for the first <img> tag in HTML content and returns its src attribute.
 * This is useful for automatically finding a representative image for BlogPosting schema.
 *
 * @param html - HTML content to search
 * @param baseUrl - Base URL to prepend to relative image URLs
 * @returns Full image URL or undefined if no image found
 *
 * @example
 * const imageUrl = extractFirstImageUrl(
 *   '<p>Text</p><img src="/img/photo.jpg" alt="Photo">',
 *   'https://example.com'
 * );
 * // Returns: 'https://example.com/img/photo.jpg'
 */
export function extractFirstImageUrl(
  html: string,
  baseUrl: string,
): string | undefined {
  // Simple regex to find first img tag's src attribute
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);

  if (!imgMatch || !imgMatch[1]) {
    return undefined;
  }

  const src = imgMatch[1];

  // If it's already a full URL, return as-is
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // Otherwise, prepend the base URL
  // Ensure baseUrl doesn't end with / and src starts with /
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const cleanSrc = src.startsWith("/") ? src : `/${src}`;

  return `${cleanBaseUrl}${cleanSrc}`;
}

/**
 * Generates multiple JSON-LD schemas for a blog post page
 *
 * This is a convenience function that generates all relevant schemas
 * for a typical blog post page: BlogPosting, BreadcrumbList, and Organization.
 *
 * @param options - BlogPosting generation options
 * @returns Array of JSON-LD schemas
 *
 * @example
 * const schemas = generatePostPageSchemas({
 *   post: { ... },
 *   site: { ... }
 * });
 * // Returns: [BlogPosting, BreadcrumbList]
 */
export function generatePostPageSchemas(
  options: BlogPostingOptions,
): SchemaOrgThing[] {
  const schemas: SchemaOrgThing[] = [];

  // Add BlogPosting schema
  schemas.push(generateBlogPostingSchema(options));

  // Add BreadcrumbList schema
  schemas.push(
    generateBreadcrumbListSchema({
      site: options.site,
      post: options.post,
    }),
  );

  return schemas;
}

/**
 * Generates multiple JSON-LD schemas for the homepage
 *
 * This is a convenience function that generates all relevant schemas
 * for the homepage: WebSite and Organization.
 *
 * @param options - WebSite generation options
 * @returns Array of JSON-LD schemas
 *
 * @example
 * const schemas = generateHomePageSchemas({
 *   site: { title: "My Blog", baseUrl: "https://example.com", ... }
 * });
 * // Returns: [WebSite, Organization]
 */
export function generateHomePageSchemas(
  options: WebSiteOptions,
): SchemaOrgThing[] {
  const schemas: SchemaOrgThing[] = [];

  // Add WebSite schema
  schemas.push(generateWebSiteSchema(options));

  // Add Organization schema
  schemas.push(generateOrganizationSchema(options.site));

  return schemas;
}
