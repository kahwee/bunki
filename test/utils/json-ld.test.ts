import { describe, test, expect } from "bun:test";
import {
  generateBlogPostingSchema,
  generateWebSiteSchema,
  generateBreadcrumbListSchema,
  generatePersonSchema,
  generateOrganizationSchema,
  generatePostPageSchemas,
  generateHomePageSchemas,
  toScriptTag,
  extractFirstImageUrl,
} from "../../src/utils/json-ld.js";
import type { Post, SiteConfig } from "../../src/types.js";

describe("JSON-LD Utilities", () => {
  // Test fixtures
  const mockSite: SiteConfig = {
    title: "My Awesome Blog",
    description: "A blog about web development and technology",
    baseUrl: "https://example.com",
    domain: "example.com",
    authorName: "John Doe",
    authorEmail: "john@example.com",
    rssLanguage: "en-US",
  };

  const mockPost: Post = {
    title: "Getting Started with Bun",
    date: "2025-01-15T10:30:00.000Z",
    tags: ["bun", "javascript", "performance"],
    tagSlugs: { bun: "bun", javascript: "javascript", performance: "performance" },
    content:
      "Bun is a fast JavaScript runtime that aims to be a drop-in replacement for Node.js. It includes a bundler, test runner, and package manager.",
    slug: "getting-started-with-bun",
    url: "/2025/getting-started-with-bun/",
    excerpt: "Learn how to get started with Bun, the fast JavaScript runtime.",
    html: "<p>Bun is a fast JavaScript runtime...</p>",
  };

  describe("generatePersonSchema", () => {
    test("should generate Person schema with name only", () => {
      const schema = generatePersonSchema("Jane Smith");

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("Person");
      expect(schema.name).toBe("Jane Smith");
      expect(schema.email).toBeUndefined();
    });

    test("should generate Person schema with name and email", () => {
      const schema = generatePersonSchema("Jane Smith", "jane@example.com");

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("Person");
      expect(schema.name).toBe("Jane Smith");
      expect(schema.email).toBe("jane@example.com");
    });
  });

  describe("generateOrganizationSchema", () => {
    test("should generate Organization schema with required fields", () => {
      const schema = generateOrganizationSchema(mockSite);

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("Organization");
      expect(schema.name).toBe("My Awesome Blog");
      expect(schema.url).toBe("https://example.com");
      expect(schema.description).toBe(
        "A blog about web development and technology",
      );
    });

    test("should generate Organization schema without description if not provided", () => {
      const siteWithoutDesc: SiteConfig = {
        ...mockSite,
        description: "",
      };
      const schema = generateOrganizationSchema(siteWithoutDesc);

      expect(schema.description).toBeUndefined();
    });
  });

  describe("generateBlogPostingSchema", () => {
    test("should generate BlogPosting schema with all fields", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
        imageUrl: "https://example.com/images/bun-logo.png",
      });

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("BlogPosting");
      expect(schema.headline).toBe("Getting Started with Bun");
      expect(schema.description).toBe(
        "Learn how to get started with Bun, the fast JavaScript runtime.",
      );
      expect(schema.url).toBe(
        "https://example.com/2025/getting-started-with-bun/",
      );
      expect(schema.mainEntityOfPage).toEqual({
        "@type": "WebPage",
        "@id": "https://example.com/2025/getting-started-with-bun/",
      });
      expect(schema.datePublished).toBe("2025-01-15T10:30:00.000Z");
      expect(schema.dateModified).toBe("2025-01-15T10:30:00.000Z");
      expect(schema.image).toBe("https://example.com/images/bun-logo.png");
    });

    test("should include author information when available", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
      });

      expect(schema.author).toEqual({
        "@type": "Person",
        name: "John Doe",
        email: "john@example.com",
      });
    });

    test("should not include author email if not provided", () => {
      const siteWithoutEmail: SiteConfig = {
        ...mockSite,
        authorEmail: undefined,
      };
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: siteWithoutEmail,
      });

      expect(schema.author.email).toBeUndefined();
    });

    test("should include publisher information", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
      });

      expect(schema.publisher).toEqual({
        "@type": "Organization",
        name: "My Awesome Blog",
        url: "https://example.com",
      });
    });

    test("should include keywords from tags", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
      });

      expect(schema.keywords).toBe("bun, javascript, performance");
    });

    test("should include articleSection from first tag", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
      });

      expect(schema.articleSection).toBe("bun");
    });

    test("should calculate word count from content", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
      });

      // The mock content has approximately 22 words
      expect(schema.wordCount).toBeGreaterThan(0);
    });

    test("should use custom dateModified if provided", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
        dateModified: "2025-01-20T15:00:00.000Z",
      });

      expect(schema.dateModified).toBe("2025-01-20T15:00:00.000Z");
      expect(schema.datePublished).toBe("2025-01-15T10:30:00.000Z");
    });

    test("should include language from rssLanguage", () => {
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: mockSite,
      });

      expect(schema.inLanguage).toBe("en-US");
    });

    test("should default to en-US if rssLanguage not provided", () => {
      const siteWithoutLang: SiteConfig = {
        ...mockSite,
        rssLanguage: undefined,
      };
      const schema = generateBlogPostingSchema({
        post: mockPost,
        site: siteWithoutLang,
      });

      expect(schema.inLanguage).toBe("en-US");
    });

    test("should handle post without tags", () => {
      const postWithoutTags: Post = {
        ...mockPost,
        tags: [],
      };
      const schema = generateBlogPostingSchema({
        post: postWithoutTags,
        site: mockSite,
      });

      expect(schema.keywords).toBeUndefined();
      expect(schema.articleSection).toBeUndefined();
    });
  });

  describe("generateWebSiteSchema", () => {
    test("should generate WebSite schema with all fields", () => {
      const schema = generateWebSiteSchema({ site: mockSite });

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("WebSite");
      expect(schema.name).toBe("My Awesome Blog");
      expect(schema.url).toBe("https://example.com");
      expect(schema.description).toBe(
        "A blog about web development and technology",
      );
    });

    test("should include search action", () => {
      const schema = generateWebSiteSchema({ site: mockSite });

      expect(schema.potentialAction).toEqual({
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://example.com/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      });
    });

    test("should handle site without description", () => {
      const siteWithoutDesc: SiteConfig = {
        ...mockSite,
        description: "",
      };
      const schema = generateWebSiteSchema({ site: siteWithoutDesc });

      expect(schema.description).toBeUndefined();
    });
  });

  describe("generateBreadcrumbListSchema", () => {
    test("should generate breadcrumb for homepage only", () => {
      const schema = generateBreadcrumbListSchema({ site: mockSite });

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("BreadcrumbList");
      expect(schema.itemListElement).toHaveLength(1);
      expect(schema.itemListElement[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://example.com",
      });
    });

    test("should generate breadcrumb for post page", () => {
      const schema = generateBreadcrumbListSchema({
        site: mockSite,
        post: mockPost,
      });

      expect(schema.itemListElement).toHaveLength(2);
      expect(schema.itemListElement[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://example.com",
      });
      expect(schema.itemListElement[1]).toEqual({
        "@type": "ListItem",
        position: 2,
        name: "Getting Started with Bun",
        item: "https://example.com/2025/getting-started-with-bun/",
      });
    });

    test("should use custom breadcrumb items if provided", () => {
      const customItems = [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
        { name: "2025", url: "https://example.com/blog/2025" },
      ];

      const schema = generateBreadcrumbListSchema({
        site: mockSite,
        items: customItems,
      });

      expect(schema.itemListElement).toHaveLength(3);
      expect(schema.itemListElement[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "Home",
        url: "https://example.com",
      });
      expect(schema.itemListElement[2]).toEqual({
        "@type": "ListItem",
        position: 3,
        name: "2025",
        url: "https://example.com/blog/2025",
      });
    });
  });

  describe("toScriptTag", () => {
    test("should convert JSON-LD to script tag", () => {
      const schema = generatePersonSchema("John Doe");
      const scriptTag = toScriptTag(schema);

      expect(scriptTag).toStartWith('<script type="application/ld+json">');
      expect(scriptTag).toEndWith("</script>");
      expect(scriptTag).toInclude('"@context": "https://schema.org"');
      expect(scriptTag).toInclude('"@type": "Person"');
      expect(scriptTag).toInclude('"name": "John Doe"');
    });

    test("should format JSON with proper indentation", () => {
      const schema = generatePersonSchema("John Doe", "john@example.com");
      const scriptTag = toScriptTag(schema);

      // Check for 2-space indentation
      expect(scriptTag).toInclude('  "@context"');
      expect(scriptTag).toInclude('  "name"');
    });
  });

  describe("extractFirstImageUrl", () => {
    test("should extract first image URL from HTML", () => {
      const html = '<p>Some text</p><img src="/images/photo.jpg" alt="Photo">';
      const imageUrl = extractFirstImageUrl(html, "https://example.com");

      expect(imageUrl).toBe("https://example.com/images/photo.jpg");
    });

    test("should handle absolute URLs", () => {
      const html = '<img src="https://cdn.example.com/image.png">';
      const imageUrl = extractFirstImageUrl(html, "https://example.com");

      expect(imageUrl).toBe("https://cdn.example.com/image.png");
    });

    test("should handle relative URLs without leading slash", () => {
      const html = '<img src="img/photo.jpg">';
      const imageUrl = extractFirstImageUrl(html, "https://example.com");

      expect(imageUrl).toBe("https://example.com/img/photo.jpg");
    });

    test("should return undefined if no image found", () => {
      const html = "<p>Just text, no images</p>";
      const imageUrl = extractFirstImageUrl(html, "https://example.com");

      expect(imageUrl).toBeUndefined();
    });

    test("should extract first image when multiple images exist", () => {
      const html =
        '<img src="/first.jpg"><img src="/second.jpg"><img src="/third.jpg">';
      const imageUrl = extractFirstImageUrl(html, "https://example.com");

      expect(imageUrl).toBe("https://example.com/first.jpg");
    });

    test("should handle single quotes in img tag", () => {
      const html = "<img src='/images/photo.jpg' alt='Photo'>";
      const imageUrl = extractFirstImageUrl(html, "https://example.com");

      expect(imageUrl).toBe("https://example.com/images/photo.jpg");
    });

    test("should handle baseUrl with trailing slash", () => {
      const html = '<img src="/images/photo.jpg">';
      const imageUrl = extractFirstImageUrl(html, "https://example.com/");

      expect(imageUrl).toBe("https://example.com/images/photo.jpg");
    });
  });

  describe("generatePostPageSchemas", () => {
    test("should generate multiple schemas for post page", () => {
      const schemas = generatePostPageSchemas({
        post: mockPost,
        site: mockSite,
      });

      expect(schemas).toHaveLength(2);
      expect(schemas[0]["@type"]).toBe("BlogPosting");
      expect(schemas[1]["@type"]).toBe("BreadcrumbList");
    });

    test("should pass through options to BlogPosting schema", () => {
      const schemas = generatePostPageSchemas({
        post: mockPost,
        site: mockSite,
        imageUrl: "https://example.com/image.jpg",
        dateModified: "2025-01-20T00:00:00.000Z",
      });

      const blogPosting = schemas[0];
      expect(blogPosting.image).toBe("https://example.com/image.jpg");
      expect(blogPosting.dateModified).toBe("2025-01-20T00:00:00.000Z");
    });
  });

  describe("generateHomePageSchemas", () => {
    test("should generate multiple schemas for homepage", () => {
      const schemas = generateHomePageSchemas({ site: mockSite });

      expect(schemas).toHaveLength(2);
      expect(schemas[0]["@type"]).toBe("WebSite");
      expect(schemas[1]["@type"]).toBe("Organization");
    });

    test("should use site configuration consistently", () => {
      const schemas = generateHomePageSchemas({ site: mockSite });

      const webSite = schemas[0];
      const organization = schemas[1];

      expect(webSite.name).toBe("My Awesome Blog");
      expect(webSite.url).toBe("https://example.com");
      expect(organization.name).toBe("My Awesome Blog");
      expect(organization.url).toBe("https://example.com");
    });
  });
});
