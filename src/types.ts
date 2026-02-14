/**
 * Post object representing a single markdown file
 */
export interface Location {
  /** Name of the location */
  name: string;
  /** Full address of the location */
  address: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
}

/**
 * Business schema data for LocalBusiness structured data
 * Includes location data for map display and geo coordinates
 */
export interface Business {
  /** Schema.org type (e.g., Restaurant, Bakery, CafeOrCoffeeShop) */
  type: string;
  /** Business name */
  name: string;
  /** Full address of the business */
  address: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Cuisine type for restaurants (e.g., "Mexican, Oaxacan") */
  cuisine?: string;
  /** Price range (e.g., "$", "$$", "$$$") */
  priceRange?: string;
  /** Business phone number */
  telephone?: string;
  /** Business website URL */
  url?: string;
  /** Opening hours in schema.org format */
  openingHours?: string;
}

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
  /** Optional location data for map display */
  location?: Location;
  /** Optional category for the post */
  category?: string;
  /** Optional business schema data for LocalBusiness structured data */
  business?: Business;
  /** Optional image URL (first image from post content, used for thumbnails and social sharing) */
  image?: string;
}

/**
 * Configuration for CSS processing
 */
export interface CSSConfig {
  /** Input CSS file path (relative to project root) */
  input: string;
  /** Output CSS file path (relative to output directory) */
  output: string;
  /** PostCSS config file path (relative to project root) */
  postcssConfig?: string;
  /** Whether to enable CSS processing */
  enabled: boolean;
  /** Whether to watch for changes in development */
  watch?: boolean;
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
  /** CSS processing configuration */
  css?: CSSConfig;
  /** Optional number of tags to display on homepage (sorted by count). If not set, all tags are shown */
  maxTagsOnHomepage?: number;
  /** Optional list of domains to exclude from nofollow attribute. Links to these domains will have follow attribute. */
  noFollowExceptions?: string[];
  /** RSS feed language code (default: en-US) */
  rssLanguage?: string;
  /** Author name for RSS feed (used in managingEditor field) */
  authorName?: string;
  /** Author email for RSS feed (used in managingEditor field) */
  authorEmail?: string;
  /** Web master email for RSS feed (optional) */
  webMaster?: string;
  /** Copyright statement for RSS feed (e.g., "Copyright © 2025 Your Site Name") */
  copyright?: string;
  /** Strict mode: fail build on parsing errors (default: false) */
  strictMode?: boolean;
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
  /** Posts grouped by year for efficient year archive generation */
  postsByYear: Record<string, Post[]>;
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
   * @param minYear Optional minimum year to filter (e.g., 2023 uploads 2023, 2024, etc.)
   * @returns Record of image filenames to their public URLs
   */
  uploadImages(
    imagesDir: string,
    minYear?: number,
  ): Promise<Record<string, string>>;
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
  minYear?: number;
}
