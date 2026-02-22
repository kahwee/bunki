import { expect, test, describe } from "bun:test";
import {
  validateBusinessLocation,
  validateTags,
  checkDeprecatedLocationField,
} from "../../../src/utils/markdown/validators";

describe("Frontmatter Validators", () => {
  describe("validateBusinessLocation", () => {
    test("should return null for valid business location", () => {
      const business = {
        type: "Restaurant",
        name: "Test Restaurant",
        address: "123 Main St",
        lat: 47.6062,
        lng: -122.3321,
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).toBeNull();
    });

    test("should validate array format", () => {
      const business = [
        {
          type: "Restaurant",
          name: "Test Restaurant",
          address: "123 Main St",
          lat: 47.6062,
          lng: -122.3321,
        },
      ];

      const error = validateBusinessLocation(business, "test.md");
      expect(error).toBeNull();
    });

    test("should error on missing type", () => {
      const business = {
        name: "Test Restaurant",
        address: "123 Main St",
        lat: 47.6062,
        lng: -122.3321,
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).not.toBeNull();
      expect(error?.type).toBe("validation");
      expect(error?.message).toInclude("Missing required field 'type'");
    });

    test("should error on invalid type", () => {
      const business = {
        type: "InvalidType",
        name: "Test Restaurant",
        address: "123 Main St",
        lat: 47.6062,
        lng: -122.3321,
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).not.toBeNull();
      expect(error?.type).toBe("validation");
      expect(error?.message).toInclude("Invalid business type");
    });

    test("should error on missing name", () => {
      const business = {
        type: "Restaurant",
        address: "123 Main St",
        lat: 47.6062,
        lng: -122.3321,
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).not.toBeNull();
      expect(error?.message).toInclude("Missing required field 'name'");
    });

    test("should error on deprecated latitude/longitude fields", () => {
      const business = {
        type: "Restaurant",
        name: "Test Restaurant",
        address: "123 Main St",
        latitude: 47.6062,
        longitude: -122.3321,
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).not.toBeNull();
      expect(error?.type).toBe("validation");
      expect(error?.message).toInclude("Use 'lat' and 'lng'");
      expect(error?.suggestion).toInclude("Replace 'latitude:'");
    });

    test("should error on missing coordinates", () => {
      const business = {
        type: "Restaurant",
        name: "Test Restaurant",
        address: "123 Main St",
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).not.toBeNull();
      expect(error?.message).toInclude("Missing required coordinates");
      expect(error?.suggestion).toInclude("REQUIRED");
    });

    test("should validate optional fields", () => {
      const business = {
        type: "Restaurant",
        name: "Test Restaurant",
        address: "123 Main St",
        lat: 47.6062,
        lng: -122.3321,
        cuisine: "Italian",
        priceRange: "$$",
        telephone: "+1-206-555-0100",
        url: "https://example.com",
        openingHours: "Mo-Su 09:00-21:00",
      };

      const error = validateBusinessLocation(business, "test.md");
      expect(error).toBeNull();
    });

    test("should return null when business is null", () => {
      const error = validateBusinessLocation(null, "test.md");
      expect(error).toBeNull();
    });

    test("should return null when business is undefined", () => {
      const error = validateBusinessLocation(undefined, "test.md");
      expect(error).toBeNull();
    });
  });

  describe("validateTags", () => {
    test("should return null for valid tags", () => {
      const tags = ["travel", "food", "new-york-city", "tech-review"];
      const error = validateTags(tags, "test.md");
      expect(error).toBeNull();
    });

    test("should error on tags with spaces", () => {
      const tags = ["travel", "new york city", "tech review"];
      const error = validateTags(tags, "test.md");

      expect(error).not.toBeNull();
      expect(error?.type).toBe("validation");
      expect(error?.message).toInclude("Tags must not contain spaces");
      expect(error?.message).toInclude('"new york city"');
      expect(error?.message).toInclude('"tech review"');
      expect(error?.suggestion).toInclude("Use hyphens");
    });

    test("should return null for empty array", () => {
      const tags: string[] = [];
      const error = validateTags(tags, "test.md");
      expect(error).toBeNull();
    });

    test("should return null when tags is null", () => {
      const error = validateTags(null as any, "test.md");
      expect(error).toBeNull();
    });

    test("should return null when tags is undefined", () => {
      const error = validateTags(undefined as any, "test.md");
      expect(error).toBeNull();
    });

    test("should return null for non-array input", () => {
      const error = validateTags("not-an-array" as any, "test.md");
      expect(error).toBeNull();
    });
  });

  describe("checkDeprecatedLocationField", () => {
    test("should error when location field exists", () => {
      const data = {
        location: {
          name: "Test Location",
        },
      };

      const error = checkDeprecatedLocationField(data, "test.md");
      expect(error).not.toBeNull();
      expect(error?.type).toBe("validation");
      expect(error?.message).toInclude("Use 'business:'");
      expect(error?.message).toInclude("deprecated 'location:'");
      expect(error?.suggestion).toInclude("Replace 'location:'");
    });

    test("should return null when location field does not exist", () => {
      const data = {
        business: {
          type: "Restaurant",
          name: "Test Restaurant",
        },
      };

      const error = checkDeprecatedLocationField(data, "test.md");
      expect(error).toBeNull();
    });

    test("should return null for empty data object", () => {
      const data = {};
      const error = checkDeprecatedLocationField(data, "test.md");
      expect(error).toBeNull();
    });

    test("should handle null data gracefully", () => {
      const error = checkDeprecatedLocationField(null, "test.md");
      expect(error).toBeNull();
    });
  });
});
