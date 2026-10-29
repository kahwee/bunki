/**
 * Template engine configuration and setup
 * Centralizes Nunjucks configuration and custom filters
 */

import nunjucks from "nunjucks";
import { DATE } from "../constants";
import { toPacificTime } from "./date-utils";
import jsonLd from "../fragments/json-ld.njk" with { type: "text" };
import ogImage from "../fragments/og-image.njk" with { type: "text" };
import pagination from "../fragments/pagination.njk" with { type: "text" };
import shareButtons from "../fragments/share-buttons.njk" with { type: "text" };

const fragments: Record<string, string> = {
  "json-ld.njk": jsonLd,
  "og-image.njk": ogImage,
  "pagination.njk": pagination,
  "share-buttons.njk": shareButtons,
};

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
 * const html = env.render("index.njk", { site, posts });
 * ```
 */
export function createTemplateEngine(
  templatesDir: string,
  watch: boolean = false,
): nunjucks.Environment {
  const FragmentLoader = nunjucks.Loader.extend({
    getSource(name: string) {
      const src = Object.hasOwn(fragments, name) ? fragments[name] : undefined;
      return src === undefined ? (null as never) : { src, path: name, noCache: false };
    },
  });
  const env = new nunjucks.Environment(
    [new nunjucks.FileSystemLoader(templatesDir, { watch }), new FragmentLoader() as never],
    { autoescape: true },
  );

  // Add date filter for Pacific timezone formatting
  env.addFilter("date", formatDate);

  // Add titlecase filter with tech acronym awareness
  env.addFilter("titlecase", titleCase);

  return env;
}

/**
 * Title case filter with tech acronym awareness
 * Converts hyphenated slugs to display titles, uppercasing known acronyms
 */
const TECH_ACRONYMS = new Set([
  "ai",
  "llm",
  "api",
  "ui",
  "ux",
  "ios",
  "url",
  "seo",
  "css",
  "html",
  "js",
  "ts",
  "sql",
  "cdn",
  "aws",
  "rss",
  "sdk",
  "cli",
  "gpu",
  "cpu",
]);

function titleCase(str: string): string {
  return str
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (TECH_ACRONYMS.has(lower)) return lower === "ios" ? "iOS" : lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
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
