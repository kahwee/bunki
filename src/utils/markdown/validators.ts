/**
 * Frontmatter and business location validators
 */

import { SCHEMA_ORG_PLACE_TYPES } from "./constants";

export interface ValidationError {
  file: string;
  type: "yaml" | "missing_field" | "file_not_found" | "unknown" | "validation";
  message: string;
  suggestion?: string;
}

/**
 * Validate business location format
 * Required fields: type, name, address, lat/lng (NOT latitude/longitude)
 * @param business - Business location data (can be array or single object)
 * @param filePath - File path for error reporting
 * @returns ValidationError if invalid, null if valid
 */
export function validateBusinessLocation(
  business: any,
  filePath: string,
): ValidationError | null {
  if (!business) return null;

  // Handle both array and single object format
  const locations = Array.isArray(business) ? business : [business];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const locIndex = locations.length > 1 ? ` (location ${i + 1})` : "";

    // Check required field: type
    if (!loc.type) {
      return {
        file: filePath,
        type: "validation",
        message: `Missing required field 'type' in business${locIndex}`,
        suggestion:
          "Add 'type: Restaurant' (or Market, Park, Hotel, Museum, Cafe, Zoo, etc.) to frontmatter",
      };
    }

    // Validate type against Schema.org Place types (O(1) Set lookup)
    if (!SCHEMA_ORG_PLACE_TYPES.has(loc.type)) {
      const exampleTypes = Array.from(SCHEMA_ORG_PLACE_TYPES).slice(0, 10);
      return {
        file: filePath,
        type: "validation",
        message: `Invalid business type '${loc.type}' in business${locIndex}`,
        suggestion: `Use a valid Schema.org Place type: ${exampleTypes.join(", ")}, etc.`,
      };
    }

    // Check required field: name
    if (!loc.name) {
      return {
        file: filePath,
        type: "validation",
        message: `Missing required field 'name' in business${locIndex}`,
        suggestion: "Add 'name: \"Full Business Name\"' to frontmatter",
      };
    }

    // Check for deprecated latitude/longitude fields
    if (loc.latitude !== undefined || loc.longitude !== undefined) {
      return {
        file: filePath,
        type: "validation",
        message: `Use 'lat' and 'lng' instead of 'latitude' and 'longitude' in business${locIndex}`,
        suggestion:
          "Replace 'latitude:' with 'lat:' and 'longitude:' with 'lng:' in frontmatter",
      };
    }

    // Check for coordinates (lat/lng are REQUIRED)
    const hasLatLng = loc.lat !== undefined && loc.lng !== undefined;

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

/**
 * Validate that tags don't contain spaces (must use hyphens)
 * @param tags - Array of tag strings
 * @param filePath - File path for error reporting
 * @returns ValidationError if invalid, null if valid
 */
export function validateTags(
  tags: string[],
  filePath: string,
): ValidationError | null {
  if (!tags || !Array.isArray(tags)) return null;

  const tagsWithSpaces = tags.filter((tag: string) => tag.includes(" "));
  if (tagsWithSpaces.length > 0) {
    return {
      file: filePath,
      type: "validation",
      message: `Tags must not contain spaces. Found: ${tagsWithSpaces.map((t: string) => `"${t}"`).join(", ")}`,
      suggestion: `Use hyphens instead of spaces. Example: "new-york-city" instead of "new york city"`,
    };
  }

  return null;
}

/**
 * Check for deprecated 'location' field (should use 'business' instead)
 * @param data - Frontmatter data
 * @param filePath - File path for error reporting
 * @returns ValidationError if found, null otherwise
 */
export function checkDeprecatedLocationField(
  data: any,
  filePath: string,
): ValidationError | null {
  if (data && data.location) {
    return {
      file: filePath,
      type: "validation",
      message: "Use 'business:' instead of deprecated 'location:' field",
      suggestion:
        "Replace 'location:' with 'business:' in frontmatter (business requires type, name, lat, lng)",
    };
  }
  return null;
}
