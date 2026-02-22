/**
 * Markdown utilities - Main export file
 * Re-exports from modular components for backward compatibility
 */

import matter from "gray-matter";
import type { Post, CDNConfig } from "../types";
import { toPacificTime, getPacificYear } from "./date-utils";
import { getBaseFilename, readFileAsText } from "./file-utils";
import {
  convertMarkdownToHtml,
  extractExcerpt,
  setNoFollowExceptions,
} from "./markdown/parser";
import type { ValidationError } from "./markdown/validators";
import {
  validateBusinessLocation,
  validateTags,
  checkDeprecatedLocationField,
} from "./markdown/validators";

// Re-export for backward compatibility
export { setNoFollowExceptions, extractExcerpt, convertMarkdownToHtml };
export type { ValidationError as ParseError };

export interface ParseMarkdownResult {
  post: Post | null;
  error: ValidationError | null;
}

/**
 * Parse a markdown file with frontmatter validation
 * @param filePath - Path to markdown file
 * @param cdnConfig - Optional CDN configuration
 * @returns ParseMarkdownResult with post data or error
 */
export async function parseMarkdownFile(
  filePath: string,
  cdnConfig?: CDNConfig,
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

    // Validate required fields
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

    // Check for deprecated 'location:' field
    const deprecatedFieldError = checkDeprecatedLocationField(data, filePath);
    if (deprecatedFieldError) {
      return {
        post: null,
        error: deprecatedFieldError,
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

    // Validate tags - must not contain spaces
    if (data.tags && Array.isArray(data.tags)) {
      const tagsError = validateTags(data.tags, filePath);
      if (tagsError) {
        return {
          post: null,
          error: tagsError,
        };
      }
    }

    const slug = getBaseFilename(filePath);
    const sanitizedHtml = convertMarkdownToHtml(content, cdnConfig);
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
      ...(data.category && { category: data.category }),
      ...(data.business && {
        business: (() => {
          // Handle array format - use first element
          const biz = Array.isArray(data.business)
            ? data.business[0]
            : data.business;
          return {
            type: biz.type,
            name: biz.name,
            address: biz.address,
            lat: biz.lat,
            lng: biz.lng,
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
