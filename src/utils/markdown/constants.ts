/**
 * Constants for markdown processing
 * Extracted for better code organization and performance
 */

// Pre-compiled regex patterns (compiled once at module load for performance)
export const RELATIVE_LINK_REGEX =
  /^(\.\.\/)+(\d{4})\/([a-zA-Z0-9_-]+?)(?:\.md)?(?:\/)?(#[^#]*)?$/;
export const IMAGE_PATH_REGEX = /^\.\.\/\.\.\/assets\/(\d{4})\/([^/]+)\/(.+)$/;
export const YOUTUBE_EMBED_REGEX =
  /<a href="(https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)[^"]*)"[^>]*>(.*?)<\/a>/g;
export const EXTERNAL_LINK_REGEX = /<a href="(https?:\/\/|\/\/)([^"]+)"/g;

// Schema.org Place types for business location validation (Set for O(1) lookup)
export const SCHEMA_ORG_PLACE_TYPES = new Set([
  "Accommodation",
  "Apartment",
  "Attraction",
  "Beach",
  "BodyOfWater",
  "Bridge",
  "Building",
  "BusStation",
  "Cafe",
  "Campground",
  "CivicStructure",
  "EventVenue",
  "Ferry",
  "Garden",
  "HistoricalSite",
  "Hotel",
  "Hostel",
  "Landmark",
  "LodgingBusiness",
  "Market",
  "Monument",
  "Museum",
  "NaturalFeature",
  "Park",
  "Playground",
  "Restaurant",
  "ServiceCenter",
  "ShoppingCenter",
  "Store",
  "TouristAttraction",
  "TrainStation",
  "Viewpoint",
  "Zoo",
]);

// GitHub-style alert icons (Heroicons outline, 20x20)
// Used for [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION] syntax
export const ALERT_ICONS = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" /></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1a6 6 0 0 0-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 0 0 .75.75h2.5a.75.75 0 0 0 .75-.75v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0 0 10 1ZM8.863 17.414a.75.75 0 0 0-.226 1.483 9.066 9.066 0 0 0 2.726 0 .75.75 0 0 0-.226-1.483 7.553 7.553 0 0 1-2.274 0Z" /></svg>',
  important:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg>',
  warning:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" /></svg>',
  caution:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" /></svg>',
} as const;
