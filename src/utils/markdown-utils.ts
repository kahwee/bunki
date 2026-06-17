/**
 * Markdown utilities - Main export file
 * Re-exports from modular components for backward compatibility
 */

import matter from "gray-matter";
import type {
  Business,
  CDNConfig,
  Frontmatter,
  FrontmatterBusiness,
  FrontmatterBusinessInput,
  Post,
} from "../types";
import { getPacificYear, toPacificTime } from "./date-utils";
import { getBaseFilename, readFileAsText } from "./file-utils";
import { convertMarkdownToHtml, extractExcerpt, setNoFollowExceptions } from "./markdown/parser";
import type { ValidationError } from "./markdown/validators";
import {
  checkDeprecatedLocationField,
  validateBusinessLocation,
  validateTags,
} from "./markdown/validators";

export type { ValidationError as ParseError };
// Re-export for backward compatibility
export { convertMarkdownToHtml, extractExcerpt, setNoFollowExceptions };

export interface ParseMarkdownResult {
  post: Post | null;
  error: ValidationError | null;
}

interface ParsedMarkdownContent {
  data: Frontmatter;
  content: string;
}

function createParseError(
  filePath: string,
  type: ValidationError["type"],
  message: string,
  suggestion?: string,
): ParseMarkdownResult {
  return {
    post: null,
    error: {
      file: filePath,
      type,
      message,
      ...(suggestion && { suggestion }),
    },
  };
}

function parseFrontmatter(fileContent: string): ParsedMarkdownContent {
  return matter(fileContent) as ParsedMarkdownContent;
}

function getMissingFrontmatterFields(data: Frontmatter): string[] {
  const missingFields: string[] = [];
  if (!data.title) missingFields.push("title");
  if (!data.date) missingFields.push("date");
  return missingFields;
}

function normalizeFrontmatterBusiness(
  business: FrontmatterBusinessInput,
): FrontmatterBusiness | null {
  const normalized = Array.isArray(business) ? business[0] : business;
  return normalized ?? null;
}

function buildBusinessSchema(business: FrontmatterBusinessInput | undefined): Business | null {
  if (!business) {
    return null;
  }

  const normalized = normalizeFrontmatterBusiness(business);
  if (!normalized) {
    return null;
  }

  return {
    type: normalized.type,
    name: normalized.name,
    address: normalized.address,
    lat: normalized.lat,
    lng: normalized.lng,
    ...(normalized.cuisine && { cuisine: normalized.cuisine }),
    ...(normalized.priceRange && { priceRange: normalized.priceRange }),
    ...(normalized.telephone && { telephone: normalized.telephone }),
    ...(normalized.url && { url: normalized.url }),
    ...(normalized.openingHours && { openingHours: normalized.openingHours }),
  };
}

function resolveCdnConfigWithYear(
  cdnConfig: CDNConfig | undefined,
  filePath: string,
  postYear: number,
): CDNConfig | undefined {
  const yearFromPath = filePath.match(/\/(\d{4})\//)?.[1];
  const resolvedYear = String(postYear) !== "NaN" ? String(postYear) : yearFromPath;

  return cdnConfig && resolvedYear ? { ...cdnConfig, postYear: resolvedYear } : undefined;
}

function buildPost(
  filePath: string,
  content: string,
  data: Frontmatter,
  cdnConfig?: CDNConfig,
): Post {
  const slug = getBaseFilename(filePath);
  const pacificDate = toPacificTime(data.date as string);
  const postYear = getPacificYear(data.date as string);
  const cdnConfigWithYear = resolveCdnConfigWithYear(cdnConfig, filePath, postYear);
  const sanitizedHtml = convertMarkdownToHtml(content, cdnConfigWithYear);
  const business = buildBusinessSchema(data.business);

  return {
    title: data.title as string,
    date: pacificDate.toISOString(),
    tags: data.tags || [],
    tagSlugs: {},
    content,
    slug,
    url: `/${postYear}/${slug}/`,
    excerpt: data.excerpt || extractExcerpt(content),
    html: sanitizedHtml,
    ...(data.seoTitle && { seoTitle: data.seoTitle }),
    ...(data.category && { category: data.category }),
    ...(business && { business }),
  };
}

function isYamlParsingError(error: unknown): { message: string; suggestion?: string } | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const { message } = error;
  const isYamlError =
    error.name === "YAMLException" || message.includes("YAML") || message.includes("mapping pair");

  if (!isYamlError) {
    return null;
  }

  let suggestion: string | undefined;
  if (message.includes("mapping pair") || message.includes("colon")) {
    suggestion = 'Quote titles/descriptions containing colons (e.g., title: "My Post: A Guide")';
  } else if (message.includes("multiline key")) {
    suggestion = "Remove nested quotes or use single quotes inside double quotes";
  }

  return { message, suggestion };
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
      return createParseError(filePath, "file_not_found", "File not found or couldn't be read");
    }

    const { data, content } = parseFrontmatter(fileContent);

    // Validate required fields
    const missingFields = getMissingFrontmatterFields(data);
    if (missingFields.length > 0) {
      return createParseError(
        filePath,
        "missing_field",
        `Missing required fields: ${missingFields.join(", ")}`,
        "Add required frontmatter fields (title and date)",
      );
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
        return { post: null, error: validationError };
      }
    }

    // Validate tags - must not contain spaces
    if (data.tags) {
      const tagsError = validateTags(data.tags, filePath);
      if (tagsError) {
        return { post: null, error: tagsError };
      }
    }

    return { post: buildPost(filePath, content, data, cdnConfig), error: null };
  } catch (error: unknown) {
    const yamlParsingError = isYamlParsingError(error);
    if (yamlParsingError) {
      return {
        post: null,
        error: {
          file: filePath,
          type: "yaml",
          message: yamlParsingError.message,
          suggestion: yamlParsingError.suggestion,
        },
      };
    }

    return {
      post: null,
      error: {
        file: filePath,
        type: "unknown",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
