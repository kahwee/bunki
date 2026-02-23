/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

/**
 * Pagination and batching constants
 */
export const PAGINATION = {
  /** Default number of items per page for paginated views */
  DEFAULT_PAGE_SIZE: 10,
  /** Batch size for parallel post processing */
  BATCH_SIZE: 10,
  /** Maximum number of posts to include in RSS feed */
  RSS_FEED_LIMIT: 40,
} as const;

/**
 * File I/O constants
 */
export const FILES = {
  /** Buffer size for file writer (1MB) */
  WRITE_BUFFER_SIZE: 1024 * 1024,
  /** Maximum sitemap file size in bytes (40KB) */
  MAX_SITEMAP_SIZE: 40000,
  /** Maximum number of URLs in a sitemap before requiring an index */
  MAX_SITEMAP_URLS: 1000,
} as const;

/**
 * SEO and indexing constants
 */
export const SEO = {
  /** Add noindex meta tag to pagination pages beyond this number */
  NOINDEX_AFTER_PAGE: 2,
} as const;

/**
 * Cache and time-based constants
 */
export const CACHE = {
  /** One month in milliseconds */
  ONE_MONTH_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Date formatting constants
 */
export const DATE = {
  /** Month names for date formatting */
  MONTHS: [
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
  ] as const,
} as const;
