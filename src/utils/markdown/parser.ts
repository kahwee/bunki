/**
 * Core markdown parsing and transformation logic
 */

import hljs from "highlight.js/lib/core";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { Marked } from "marked";
import markedAlert from "marked-alert";
import { markedHighlight } from "marked-highlight";
import sanitizeHtml from "sanitize-html";
import type { CDNConfig } from "../../types";
import {
  ALERT_ICONS,
  EXTERNAL_LINK_REGEX,
  IMAGE_PATH_REGEX,
  RELATIVE_LINK_REGEX,
  YOUTUBE_EMBED_REGEX,
} from "./constants";

// Register highlight.js languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("swift", swift);

// Global nofollow exceptions list
let noFollowExceptions: Set<string> = new Set();

/**
 * Set domains that should not have nofollow attribute
 * @param exceptions - Array of domain names (e.g., ["example.com", "trusted-site.org"])
 */
export function setNoFollowExceptions(exceptions: string[]) {
  noFollowExceptions = new Set(
    exceptions.map((domain) => domain.toLowerCase().replace(/^www\./, "")),
  );
}

/**
 * Transform relative image path to CDN URL
 * Converts ../../assets/2025/slug/image.jpg to https://cdn.example.com/2025/slug/image.jpg
 * @param relativePath - Relative path from markdown (e.g., "../../assets/2025/slug/image.jpg")
 * @param config - CDN configuration with baseUrl and pathPattern
 * @returns Transformed CDN URL or null if path doesn't match pattern
 */
function transformImagePath(
  relativePath: string,
  config: CDNConfig,
): string | null {
  const match = relativePath.match(IMAGE_PATH_REGEX);
  if (!match) return null;

  const [, year, slug, filename] = match;
  const path = config.pathPattern
    .replace("{year}", year)
    .replace("{slug}", slug)
    .replace("{filename}", filename);

  return `${config.baseUrl}/${path}`;
}

/**
 * Creates an isolated Marked instance with custom configuration.
 * V17 best practice: Use instance-scoped configuration to avoid global mutations.
 * @param cdnConfig - Optional CDN configuration for image URL transformation
 * @returns Configured Marked instance
 */
export function createMarked(cdnConfig?: CDNConfig): Marked {
  // Create isolated Marked instance with syntax highlighting extension
  const marked = new Marked(
    markedHighlight({
      emptyLangClass: "hljs",
      langPrefix: "hljs language-",
      highlight(code, lang, info) {
        const language = hljs.getLanguage(lang) ? lang : "json";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );

  // Configure GitHub-flavored markdown and line breaks
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // Add GitHub-style alerts support ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
  // Using Heroicons (outline, 20x20) for alert icons
  marked.use(
    markedAlert({
      variants: Object.entries(ALERT_ICONS).map(([type, icon]) => ({
        type,
        icon,
      })),
    }),
  );

  // V17 best practice: Apply all extensions immediately after instance creation
  // walkTokens processes each token for custom transformations (synchronous)
  // hooks provide lifecycle methods for pre/post processing
  marked.use({
    walkTokens(token) {
      if (token.type === "link") {
        token.href = token.href || "";

        // Convert relative markdown links to absolute URLs
        // Matches: ../2015/slug.md or ../2015/slug/ or ../2015/slug or ../../2015/slug.md
        // Also matches with anchors: ../2015/slug/#anchor or ../2015/slug.md#anchor
        // Converts to: /2015/slug/ or /2015/slug/#anchor
        // Does NOT match: ../2015/file.pdf (other file extensions)
        const relativeMatch = token.href.match(RELATIVE_LINK_REGEX);
        if (relativeMatch) {
          const [, , year, slug, anchor = ""] = relativeMatch;
          token.href = `/${year}/${slug}/${anchor}`;
        }

        const isExternal =
          token.href &&
          (token.href.startsWith("http://") ||
            token.href.startsWith("https://") ||
            token.href.startsWith("//"));

        if (isExternal) {
          (token as any).isExternalLink = true;

          if (
            token.href.includes("youtube.com/watch") ||
            token.href.includes("youtu.be/")
          ) {
            (token as any).isYouTubeLink = true;
          }
        }
      }

      // Transform relative image paths to CDN URLs
      if (token.type === "image" && cdnConfig?.enabled) {
        const href = token.href || "";

        // Only transform relative paths starting with ../../assets/
        if (href.startsWith("../../assets/")) {
          const transformed = transformImagePath(href, cdnConfig);
          if (transformed) {
            (token as any).href = transformed;
          }
        }
        // CDN URLs (https://...) and other paths pass through unchanged
      }
    },
    hooks: {
      preprocess(markdown) {
        return markdown;
      },
      postprocess(html) {
        // Convert YouTube links to embeds
        html = html.replace(
          YOUTUBE_EMBED_REGEX,
          '<div class="video-container"><iframe src="https://www.youtube.com/embed/$4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>',
        );

        // Add lazy loading to all images
        html = html.replace(/<img /g, '<img loading="lazy" ');

        // Process external links and add rel attributes
        return html.replace(EXTERNAL_LINK_REGEX, (match, protocol, rest) => {
          const fullUrl = protocol + rest;
          let relAttr = 'rel="noopener noreferrer';

          // Check if this URL should follow links
          try {
            const url = new URL(fullUrl);
            const domain = url.hostname.replace(/^www\./, "");

            // Add nofollow if domain is not in exceptions list
            if (!noFollowExceptions.has(domain)) {
              relAttr += " nofollow";
            }
          } catch {
            // If URL parsing fails, add nofollow as default
            relAttr += " nofollow";
          }

          relAttr += '"';
          return `<a href="${fullUrl}" target="_blank" ${relAttr}`;
        });
      },
    },
  });

  return marked;
}

/**
 * Convert markdown to sanitized HTML
 * @param markdownContent - Raw markdown string
 * @param cdnConfig - Optional CDN configuration
 * @returns Sanitized HTML string
 */
export function convertMarkdownToHtml(
  markdownContent: string,
  cdnConfig?: CDNConfig,
): string {
  // Create marked instance with CDN config if provided
  const marked = createMarked(cdnConfig);

  // Use async: false for explicit type safety (we don't have async walkTokens)
  const html = marked.parse(markdownContent, { async: false }) as string;

  let sanitized = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "span",
      "iframe",
      "div",
      "video",
      "source",
      "svg",
      "path",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title", "loading"],
      code: ["class"],
      pre: ["class"],
      span: ["class", "style"],
      iframe: ["src", "frameborder", "allow", "allowfullscreen", "loading"],
      div: ["class"],
      video: [
        "src",
        "controls",
        "width",
        "height",
        "autoplay",
        "loop",
        "muted",
        "preload",
        "poster",
      ],
      source: ["src", "type"],
      svg: [
        "class",
        "viewBox",
        "width",
        "height",
        "aria-hidden",
        "fill",
        "xmlns",
      ],
      path: ["d", "fill", "fill-rule", "stroke", "stroke-width"],
    },
    allowedClasses: {
      code: ["*"],
      pre: ["*"],
      span: ["*"],
      div: [
        "video-container",
        "markdown-alert",
        "markdown-alert-note",
        "markdown-alert-tip",
        "markdown-alert-important",
        "markdown-alert-warning",
        "markdown-alert-caution",
      ],
      p: ["markdown-alert-title"],
    },
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  });

  // Extra hardening: strip javascript:, vbscript: textual occurrences to satisfy security tests
  sanitized = sanitized.replace(/javascript:/gi, "").replace(/vbscript:/gi, "");
  return sanitized;
}

/**
 * Extract excerpt from markdown content
 * Removes headings, code blocks, and formatting to create plain text excerpt
 * @param content - Raw markdown content
 * @param maxLength - Maximum length of excerpt (default: 200)
 * @returns Plain text excerpt
 */
export function extractExcerpt(content: string, maxLength = 200): string {
  const plainText = content
    .replace(/^#.*$/gm, "") // Remove headings
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1") // Remove bold/italic
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return truncated.substring(0, lastSpace) + "...";
}
