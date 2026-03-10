import { describe, test, expect } from "bun:test";
import {
  generateCollectionSchemas,
  generateHomeBreadcrumbs,
} from "../../src/utils/schema-factory";
import type { SiteConfig, Post } from "../../src/types";

const config: SiteConfig = {
  title: "Test Blog",
  description: "A test blog",
  baseUrl: "https://example.com",
  domain: "example.com",
};

function makePost(slug: string): Post {
  return {
    title: "Test Post",
    date: "2025-01-01T00:00:00Z",
    tags: ["test"],
    tagSlugs: { test: "test" },
    content: "Content",
    slug,
    url: `/2025/${slug}/`,
    excerpt: "Excerpt",
    html: "<p>Content</p>",
  };
}

describe("generateCollectionSchemas", () => {
  test("returns HTML string containing JSON-LD script tags", () => {
    const html = generateCollectionSchemas(config, {
      title: "JavaScript",
      description: "Articles about JavaScript",
      url: "https://example.com/tags/javascript/",
      posts: [makePost("intro-to-js")],
      breadcrumbs: [
        { name: "Home", url: "https://example.com/" },
        { name: "JavaScript", url: "https://example.com/tags/javascript/" },
      ],
    });

    expect(html).toBeString();
    expect(html).toInclude("<script");
    expect(html).toInclude("application/ld+json");
    expect(html).toInclude("CollectionPage");
    expect(html).toInclude("BreadcrumbList");
  });

  test("includes page title in schema output", () => {
    const html = generateCollectionSchemas(config, {
      title: "My Tag Page",
      description: "Articles for this tag",
      url: "https://example.com/tags/my-tag/",
      posts: [],
      breadcrumbs: [{ name: "Home", url: "https://example.com/" }],
    });

    expect(html).toInclude("My Tag Page");
  });

  test("includes breadcrumb names in schema output", () => {
    const html = generateCollectionSchemas(config, {
      title: "2025 Archive",
      description: "Posts from 2025",
      url: "https://example.com/2025/",
      posts: [],
      breadcrumbs: [
        { name: "Home", url: "https://example.com/" },
        { name: "2025", url: "https://example.com/2025/" },
      ],
    });

    expect(html).toInclude("Home");
    expect(html).toInclude("2025");
  });

  test("works with an empty posts array", () => {
    const html = generateCollectionSchemas(config, {
      title: "Empty Tag",
      description: "No posts",
      url: "https://example.com/tags/empty/",
      posts: [],
      breadcrumbs: [{ name: "Home", url: "https://example.com/" }],
    });

    expect(html).toBeString();
    expect(html).toInclude("CollectionPage");
  });
});

describe("generateHomeBreadcrumbs", () => {
  test("returns HTML string with JSON-LD script tag", () => {
    const html = generateHomeBreadcrumbs(config);
    expect(html).toBeString();
    expect(html).toInclude("<script");
    expect(html).toInclude("application/ld+json");
  });

  test("includes BreadcrumbList schema type", () => {
    const html = generateHomeBreadcrumbs(config);
    expect(html).toInclude("BreadcrumbList");
  });

  test("includes Home as the breadcrumb item", () => {
    const html = generateHomeBreadcrumbs(config);
    expect(html).toInclude("Home");
    expect(html).toInclude("https://example.com/");
  });

  test("uses the site baseUrl in the breadcrumb", () => {
    const customConfig: SiteConfig = {
      ...config,
      baseUrl: "https://myblog.io",
    };
    const html = generateHomeBreadcrumbs(customConfig);
    expect(html).toInclude("https://myblog.io/");
  });
});
