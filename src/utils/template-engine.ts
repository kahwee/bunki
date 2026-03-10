/**
 * Template engine configuration and setup
 * Centralizes Nunjucks configuration and custom filters
 */

import nunjucks from "nunjucks";
import path from "path";
import { existsSync } from "fs";
import { toPacificTime } from "./date-utils";
import { DATE } from "../constants";

// In the built bundle (dist/cli.js), import.meta.dir is the dist/ directory and
// fragments live at dist/fragments/. When running tests directly from source,
// import.meta.dir is src/utils/ so we fall back to src/fragments/.
const _distFragments = path.join(import.meta.dir, "fragments");
const _srcFragments = path.join(import.meta.dir, "../fragments");
const BUNKI_FRAGMENTS_DIR = existsSync(_distFragments)
  ? _distFragments
  : _srcFragments;

/**
 * Create and configure Nunjucks template engine with custom filters
 *
 * @param templatesDir - Directory containing template files
 * @param watch - Enable template watching for development (default: false)
 * @returns Configured Nunjucks environment
 *
 * @example
 * ```typescript
 * const env = createTemplateEngine("./templates");
 * const html = nunjucks.render("index.njk", { site, posts });
 * ```
 */
export function createTemplateEngine(
  templatesDir: string,
  watch: boolean = false,
): nunjucks.Environment {
  const env = nunjucks.configure([templatesDir, BUNKI_FRAGMENTS_DIR], {
    autoescape: true,
    watch,
  });

  // Add date filter for Pacific timezone formatting
  env.addFilter("date", formatDate);

  return env;
}

/**
 * Format date filter for Nunjucks templates
 * Converts dates to Pacific timezone and formats according to specified pattern
 *
 * @param date - Date string or Date object
 * @param format - Format string (YYYY, MMMM D, YYYY, MMMM D, YYYY h:mm A, or default)
 * @returns Formatted date string
 */
function formatDate(date: string | Date, format?: string): string {
  const d = toPacificTime(date);
  const month = DATE.MONTHS[d.getMonth()];

  switch (format) {
    case "YYYY":
      return d.getFullYear().toString();

    case "MMMM D, YYYY":
      return `${month} ${d.getDate()}, ${d.getFullYear()}`;

    case "MMMM D, YYYY h:mm A": {
      const hours = d.getHours() % 12 || 12;
      const ampm = d.getHours() >= 12 ? "PM" : "AM";
      return `${month} ${d.getDate()}, ${d.getFullYear()} @ ${hours} ${ampm}`;
    }

    default:
      return d.toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
      });
  }
}
