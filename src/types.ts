/**
 * Post object representing a single markdown file
 */
export interface Post {
  /** Title of the post */
  title: string;
  /** Date of the post in ISO format */
  date: string;
  /** Array of tags associated with the post */
  tags: string[];
  /** Map of tag names to their slugs */
  tagSlugs: Record<string, string>;
  /** Raw markdown content */
  content: string;
  /** Slug used in the URL */
  slug: string;
  /** URL path for this post */
  url: string;
  /** Brief excerpt from the post content */
  excerpt: string;
  /** Rendered HTML content */
  html: string;
}

/**
 * Configuration for the site
 */
export interface SiteConfig {
  /** Site title */
  title: string;
  /** Site description */
  description: string;
  /** Base URL for the site (e.g., https://example.com) */
  baseUrl: string;
  /** Site identifier (used for metadata) */
  domain: string;
  /** Optional public URL for the bucket */
  publicUrl?: string;
  /** Optional S3 client configuration (accessKeyId, secretAccessKey, bucket, etc.) */
  s3?: S3Config;
  /** Additional custom configuration options */
  [key: string]: any;
}

/**
 * Options for initializing the site generator
 */
export interface GeneratorOptions {
  /** Directory containing markdown content */
  contentDir: string;
  /** Directory where generated files will be output */
  outputDir: string;
  /** Directory containing template files */
  templatesDir: string;
  /** Site configuration */
  config: SiteConfig;
}

/**
 * Data structure for tag information
 */
export interface TagData {
  /** Name of the tag */
  name: string;
  /** URL-friendly slug version of the tag name */
  slug: string;
  /** Number of posts with this tag */
  count: number;
  /** Array of posts with this tag */
  posts: Post[];
  /** Optional description of the tag */
  description?: string;
}

/**
 * Pagination information for archives and tag pages
 */
export interface PaginationData {
  /** Current page number */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
  /** Next page number or null if no next page */
  nextPage: number | null;
  /** Previous page number or null if no previous page */
  prevPage: number | null;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Base path for pagination URLs */
  pagePath: string;
}

/**
 * Data structure for blog information
 */
export interface Site {
  /** Site identifier */
  name: string;
  /** Array of posts for the site */
  posts: Post[];
  /** Map of tag names to tag data */
  tags: Record<string, TagData>;
}

/**
 * Interface for uploaders (different services can implement this)
 */
export interface Uploader {
  upload(sourcePath: string, config: SiteConfig): Promise<void>;
}

/**
 * Interface for image uploaders
 */
export interface ImageUploader {
  /**
   * Upload all images from a directory
   * @param imagesDir Directory containing images to upload
   * @returns Record of image filenames to their public URLs
   */
  uploadImages(imagesDir: string): Promise<Record<string, string>>;
}

// We'll use S3Config directly instead of having a separate S3ClientOptions interface

/**
 * S3 configuration type
 */
export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  /** S3 client options */
  endpoint?: string;
  region?: string;
}

/**
 * Options for image upload
 */
export interface ImageUploadOptions {
  domain?: string;
  images?: string;
  outputJson?: string;
}
