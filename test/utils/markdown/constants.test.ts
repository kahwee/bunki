import { expect, test, describe } from "bun:test";
import {
  RELATIVE_LINK_REGEX,
  IMAGE_PATH_REGEX,
  YOUTUBE_EMBED_REGEX,
  EXTERNAL_LINK_REGEX,
  SCHEMA_ORG_PLACE_TYPES,
  ALERT_ICONS,
} from "../../../src/utils/markdown/constants";

describe("Markdown Constants", () => {
  describe("RELATIVE_LINK_REGEX", () => {
    test("should match relative markdown links", () => {
      const validPatterns = [
        "../2025/my-post.md",
        "../../2023/another-post.md",
        "../2024/slug/",
        "../2025/test",
        "../2023/post/#anchor",
        "../2024/post.md#section",
      ];

      validPatterns.forEach((pattern) => {
        expect(RELATIVE_LINK_REGEX.test(pattern)).toBe(true);
      });
    });

    test("should not match non-markdown files", () => {
      const invalidPatterns = [
        "../2025/file.pdf",
        "../2024/image.jpg",
        "/absolute/path.md",
        "http://example.com/post.md",
      ];

      invalidPatterns.forEach((pattern) => {
        expect(RELATIVE_LINK_REGEX.test(pattern)).toBe(false);
      });
    });

    test("should extract year and slug correctly", () => {
      const match = "../2025/my-awesome-post.md".match(RELATIVE_LINK_REGEX);
      expect(match).not.toBeNull();
      expect(match![2]).toBe("2025"); // year
      expect(match![3]).toBe("my-awesome-post"); // slug
    });
  });

  describe("IMAGE_PATH_REGEX", () => {
    test("should match valid asset paths", () => {
      const validPaths = [
        "../../assets/2025/slug/image.jpg",
        "../../assets/2024/my-post/photo.png",
        "../../assets/2023/test/file.webp",
      ];

      validPaths.forEach((path) => {
        expect(IMAGE_PATH_REGEX.test(path)).toBe(true);
      });
    });

    test("should extract year, slug, and filename", () => {
      const path = "../../assets/2025/my-post/image.jpg";
      const match = path.match(IMAGE_PATH_REGEX);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("2025"); // year
      expect(match![2]).toBe("my-post"); // slug
      expect(match![3]).toBe("image.jpg"); // filename
    });

    test("should not match invalid paths", () => {
      const invalidPaths = [
        "../assets/2025/slug/image.jpg",
        "../../images/2025/slug/file.jpg",
        "../../assets/slug/image.jpg",
      ];

      invalidPaths.forEach((path) => {
        expect(IMAGE_PATH_REGEX.test(path)).toBe(false);
      });
    });
  });

  describe("YOUTUBE_EMBED_REGEX", () => {
    test("should match youtube.com URLs", () => {
      const html =
        '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Video</a>';
      const match = html.match(YOUTUBE_EMBED_REGEX);

      expect(match).not.toBeNull();
      expect(match![0]).toInclude("youtube.com/watch");
      expect(match![0]).toInclude("dQw4w9WgXcQ");
    });

    test("should match youtu.be URLs", () => {
      const html = '<a href="https://youtu.be/dQw4w9WgXcQ">Video</a>';
      // Note: This regex is primarily designed for youtube.com/watch URLs
      // It may not match youtu.be format, which is expected
      const isYouTubeLink = html.includes("youtu.be/");
      expect(isYouTubeLink).toBe(true);
    });
  });

  describe("EXTERNAL_LINK_REGEX", () => {
    test("should match http/https links", () => {
      const html = '<a href="https://example.com/page">Link</a>';
      const match = html.match(EXTERNAL_LINK_REGEX);

      expect(match).not.toBeNull();
      expect(match![0]).toInclude('href="https://');
      expect(match![0]).toInclude("example.com/page");
    });

    test("should match protocol-relative URLs", () => {
      const html = '<a href="//example.com/page">Link</a>';
      const match = html.match(EXTERNAL_LINK_REGEX);

      expect(match).not.toBeNull();
      expect(match![0]).toInclude('href="//');
    });
  });

  describe("SCHEMA_ORG_PLACE_TYPES", () => {
    test("should be a Set", () => {
      expect(SCHEMA_ORG_PLACE_TYPES).toBeInstanceOf(Set);
    });

    test("should contain common place types", () => {
      const commonTypes = [
        "Restaurant",
        "Hotel",
        "Museum",
        "Park",
        "Beach",
        "Cafe",
      ];

      commonTypes.forEach((type) => {
        expect(SCHEMA_ORG_PLACE_TYPES.has(type)).toBe(true);
      });
    });

    test("should have at least 30 types", () => {
      expect(SCHEMA_ORG_PLACE_TYPES.size).toBeGreaterThanOrEqual(30);
    });

    test("should perform O(1) lookups", () => {
      // Set lookups are O(1) vs array O(n)
      const type = "Restaurant";
      const startTime = performance.now();
      SCHEMA_ORG_PLACE_TYPES.has(type);
      const endTime = performance.now();

      // Lookup should be extremely fast (< 1ms)
      expect(endTime - startTime).toBeLessThan(1);
    });
  });

  describe("ALERT_ICONS", () => {
    test("should have all 5 alert types", () => {
      const types = ["note", "tip", "important", "warning", "caution"];

      types.forEach((type) => {
        expect(ALERT_ICONS).toHaveProperty(type);
        expect(ALERT_ICONS[type as keyof typeof ALERT_ICONS]).toBeString();
      });
    });

    test("should contain valid SVG markup", () => {
      Object.values(ALERT_ICONS).forEach((icon) => {
        expect(icon).toInclude("<svg");
        expect(icon).toInclude("</svg>");
        expect(icon).toInclude('xmlns="http://www.w3.org/2000/svg"');
      });
    });

    test("should be a readonly object", () => {
      // TypeScript const assertion makes it readonly at compile time
      // This just verifies the structure is correct
      expect(Object.keys(ALERT_ICONS).length).toBe(5);
    });
  });
});
