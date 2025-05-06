// Export types
export * from "./types";

// Export core functionality
export { SiteGenerator } from "./site-generator";
export { parseMarkdownDirectory } from "./parser";
export { startServer } from "./server";

// Export config utilities
export {
  DEFAULT_CONTENT_DIR,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_TEMPLATES_DIR,
  DEFAULT_CONFIG_FILE,
  loadConfig,
  createDefaultConfig,
  configExists,
  saveConfig,
} from "./config";

// Export utility functions
export {
  extractExcerpt,
  convertMarkdownToHtml,
  parseMarkdownFile,
} from "./utils/markdown-utils";
export {
  findFilesByPattern,
  fileExists,
  readFileAsText,
  getBaseFilename,
  ensureDir,
  copyFile,
} from "./utils/file-utils";
