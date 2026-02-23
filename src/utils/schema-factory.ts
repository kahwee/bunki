/**
 * Schema generation factory
 * Simplifies creation of JSON-LD structured data for common page types
 */

import {
  generateCollectionPageSchema,
  generateBreadcrumbListSchema,
  schemasToHtml,
} from "./json-ld";
import type { SiteConfig, Post } from "../types";

/**
 * Options for generating collection page schemas (tag pages, year archives, etc.)
 */
export interface CollectionSchemaOptions {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Canonical URL for the page */
  url: string;
  /** Posts included in the collection */
  posts: Post[];
  /** Breadcrumb navigation items */
  breadcrumbs: Array<{ name: string; url: string }>;
}

/**
 * Generate JSON-LD schemas for collection pages (tag pages, year archives, etc.)
 *
 * This factory function eliminates duplication when creating schemas for
 * pages that display a collection of posts with breadcrumb navigation.
 *
 * Generates both CollectionPage and BreadcrumbList schemas.
 *
 * @param config - Site configuration
 * @param options - Collection page options
 * @returns HTML-encoded JSON-LD script tags ready for insertion
 *
 * @example
 * ```typescript
 * // Tag page schemas
 * const jsonLd = generateCollectionSchemas(config, {
 *   title: "JavaScript",
 *   description: "Articles about JavaScript",
 *   url: "https://example.com/tags/javascript/",
 *   posts: tagPosts,
 *   breadcrumbs: [
 *     { name: "Home", url: "https://example.com/" },
 *     { name: "JavaScript", url: "https://example.com/tags/javascript/" }
 *   ],
 * });
 * ```
 */
export function generateCollectionSchemas(
  config: SiteConfig,
  options: CollectionSchemaOptions,
): string {
  const schemas = [
    generateCollectionPageSchema({
      title: options.title,
      description: options.description,
      url: options.url,
      posts: options.posts,
      site: config,
    }),
    generateBreadcrumbListSchema({
      site: config,
      items: options.breadcrumbs,
    }),
  ];

  return schemasToHtml(schemas);
}

/**
 * Generate breadcrumb schema for homepage
 *
 * @param config - Site configuration
 * @returns HTML-encoded JSON-LD script tag
 */
export function generateHomeBreadcrumbs(config: SiteConfig): string {
  const schema = generateBreadcrumbListSchema({
    site: config,
    items: [{ name: "Home", url: `${config.baseUrl}/` }],
  });

  return schemasToHtml([schema]);
}
