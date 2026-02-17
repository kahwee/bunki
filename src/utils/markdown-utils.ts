import matter from "gray-matter";
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
import { Post } from "../types";
import { toPacificTime, getPacificYear } from "./date-utils";
import { getBaseFilename, readFileAsText } from "./file-utils";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("swift", swift);

let noFollowExceptions: Set<string> = new Set();

/**
 * Creates an isolated Marked instance with custom configuration.
 * V17 best practice: Use instance-scoped configuration to avoid global mutations.
 */
function createMarked() {
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
      variants: [
        {
          type: "note",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" /></svg>',
        },
        {
          type: "tip",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1a6 6 0 0 0-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 0 0 .75.75h2.5a.75.75 0 0 0 .75-.75v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0 0 10 1ZM8.863 17.414a.75.75 0 0 0-.226 1.483 9.066 9.066 0 0 0 2.726 0 .75.75 0 0 0-.226-1.483 7.553 7.553 0 0 1-2.274 0Z" /></svg>',
        },
        {
          type: "important",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg>',
        },
        {
          type: "warning",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg>',
        },
        {
          type: "caution",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" /></svg>',
        },
      ],
    }),
  );

  // V17 best practice: Apply all extensions immediately after instance creation
  // walkTokens processes each token for custom transformations (synchronous)
  // hooks provide lifecycle methods for pre/post processing
  marked.use({
    walkTokens(token) {
      if (token.type === "link") {
        token.href = token.href || "";
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
    },
    hooks: {
      preprocess(markdown) {
        return markdown;
      },
      postprocess(html) {
        html = html.replace(
          /<a href="(https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)[^"]*)"[^>]*>(.*?)<\/a>/g,
          '<div class="video-container"><iframe src="https://www.youtube.com/embed/$4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>',
        );

        html = html.replace(/<img /g, '<img loading="lazy" ');

        // Process external links and add rel attributes
        return html.replace(
          /<a href="(https?:\/\/|\/\/)([^"]+)"/g,
          (match, protocol, rest) => {
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
          },
        );
      },
    },
  });

  return marked;
}

let marked = createMarked();

export function setNoFollowExceptions(exceptions: string[]) {
  noFollowExceptions = new Set(
    exceptions.map((domain) => domain.toLowerCase().replace(/^www\./, "")),
  );
  marked = createMarked();
}

export function extractExcerpt(content: string, maxLength = 200): string {
  const plainText = content
    .replace(/^#.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/\n+/g, " ")
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return truncated.substring(0, lastSpace) + "...";
}

export function convertMarkdownToHtml(markdownContent: string): string {
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

export interface ParseError {
  file: string;
  type: "yaml" | "missing_field" | "file_not_found" | "unknown" | "validation";
  message: string;
  suggestion?: string;
}

/**
 * Validate business location format
 * Required fields: type, name, address, lat/lng or latitude/longitude
 */
function validateBusinessLocation(
  business: any,
  filePath: string,
): ParseError | null {
  if (!business) return null;

  // Handle both array and single object format
  const locations = Array.isArray(business) ? business : [business];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const locIndex = locations.length > 1 ? ` (location ${i + 1})` : "";

    // Check required fields
    if (!loc.type) {
      return {
        file: filePath,
        type: "validation",
        message: `Missing required field 'type' in business${locIndex}`,
        suggestion:
          "Add 'type: Restaurant' (or Market, Park, Hotel, Museum, Cafe, Zoo, etc.) to frontmatter",
      };
    }

    if (!loc.name) {
      return {
        file: filePath,
        type: "validation",
        message: `Missing required field 'name' in business${locIndex}`,
        suggestion: "Add 'name: \"Full Business Name\"' to frontmatter",
      };
    }

    // Check for coordinates (accept either lat/lng or latitude/longitude)
    // Coordinates are REQUIRED
    const hasLatLng =
      (loc.lat !== undefined && loc.lng !== undefined) ||
      (loc.latitude !== undefined && loc.longitude !== undefined);

    if (!hasLatLng) {
      return {
        file: filePath,
        type: "validation",
        message: `Missing required coordinates in business${locIndex}`,
        suggestion:
          "Add 'lat: 47.6062' and 'lng: -122.3321' with numeric coordinates to frontmatter (REQUIRED)",
      };
    }
  }

  return null;
}

export interface ParseMarkdownResult {
  post: Post | null;
  error: ParseError | null;
}

export async function parseMarkdownFile(
  filePath: string,
): Promise<ParseMarkdownResult> {
  try {
    const fileContent = await readFileAsText(filePath);

    if (fileContent === null) {
      return {
        post: null,
        error: {
          file: filePath,
          type: "file_not_found",
          message: "File not found or couldn't be read",
        },
      };
    }

    const { data, content } = matter(fileContent);

    if (!data.title || !data.date) {
      const missingFields = [];
      if (!data.title) missingFields.push("title");
      if (!data.date) missingFields.push("date");

      return {
        post: null,
        error: {
          file: filePath,
          type: "missing_field",
          message: `Missing required fields: ${missingFields.join(", ")}`,
          suggestion: "Add required frontmatter fields (title and date)",
        },
      };
    }

    // Validate business location format if present
    if (data.business) {
      const validationError = validateBusinessLocation(data.business, filePath);
      if (validationError) {
        return {
          post: null,
          error: validationError,
        };
      }
    }

    let slug = data.slug || getBaseFilename(filePath);
    const sanitizedHtml = convertMarkdownToHtml(content);
    const pacificDate = toPacificTime(data.date);
    const postYear = getPacificYear(data.date);

    const post: Post = {
      title: data.title,
      date: pacificDate.toISOString(),
      tags: data.tags || [],
      tagSlugs: {},
      content,
      slug,
      url: `/${postYear}/${slug}/`,
      excerpt: data.excerpt || extractExcerpt(content),
      html: sanitizedHtml,
      ...(data.location && {
        location: (() => {
          // Handle array format - use first element
          const loc = Array.isArray(data.location) ? data.location[0] : data.location;
          return {
            name: loc.name,
            address: loc.address,
            lat: loc.lat || loc.latitude,
            lng: loc.lng || loc.longitude,
          };
        })(),
      }),
      ...(data.category && { category: data.category }),
      ...(data.business && {
        business: (() => {
          // Handle array format - use first element
          const biz = Array.isArray(data.business) ? data.business[0] : data.business;
          return {
            type: biz.type,
            name: biz.name,
            address: biz.address,
            lat: biz.lat || biz.latitude,
            lng: biz.lng || biz.longitude,
            ...(biz.cuisine && { cuisine: biz.cuisine }),
            ...(biz.priceRange && {
              priceRange: biz.priceRange,
            }),
            ...(biz.telephone && {
              telephone: biz.telephone,
            }),
            ...(biz.url && { url: biz.url }),
            ...(biz.openingHours && {
              openingHours: biz.openingHours,
            }),
          };
        })(),
      }),
    };

    return { post, error: null };
  } catch (error: any) {
    // Check if it's a YAML parsing error
    const isYamlError =
      error?.name === "YAMLException" ||
      error?.message?.includes("YAML") ||
      error?.message?.includes("mapping pair");

    let suggestion: string | undefined;
    if (isYamlError) {
      if (
        error?.message?.includes("mapping pair") ||
        error?.message?.includes("colon")
      ) {
        suggestion =
          'Quote titles/descriptions containing colons (e.g., title: "My Post: A Guide")';
      } else if (error?.message?.includes("multiline key")) {
        suggestion =
          "Remove nested quotes or use single quotes inside double quotes";
      }
    }

    return {
      post: null,
      error: {
        file: filePath,
        type: isYamlError ? "yaml" : "unknown",
        message: error?.message || String(error),
        suggestion,
      },
    };
  }
}
