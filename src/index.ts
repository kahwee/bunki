// Export types

// Export config utilities
export {
  configExists,
  createDefaultConfig,
  DEFAULT_CONFIG_FILE,
  DEFAULT_CONTENT_DIR,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_TEMPLATES_DIR,
  loadConfig,
  saveConfig,
} from "./config";

// Export constants
export { CACHE, DATE, FILES, PAGINATION, SEO } from "./constants";

// Export core functionality
export { parseMarkdownDirectory } from "./parser";
export { startServer } from "./server";
export { SiteGenerator } from "./site-generator";
export * from "./types";

// Export utility functions
export {
  copyFile,
  ensureDir,
  fileExists,
  findFilesByPattern,
  getBaseFilename,
  readFileAsText,
} from "./utils/file-utils";
// Export image uploader functions
export { DEFAULT_IMAGES_DIR, uploadImages } from "./utils/image-uploader";
export {
  convertMarkdownToHtml,
  extractExcerpt,
  parseMarkdownFile,
} from "./utils/markdown-utils";
export { createUploader } from "./utils/s3-uploader";
export {
  generateCollectionSchemas,
  generateHomeBreadcrumbs,
} from "./utils/schema-factory";
export { createTemplateEngine } from "./utils/template-engine";
