import { describe, expect, test } from "bun:test";
import { createSiteModel, groupPostsByYear } from "../src/site-model";
import type { Post, SiteConfig } from "../src/types";

const config: SiteConfig = {
  title: "Test Blog",
  description: "Test description",
  baseUrl: "https://example.com",
  domain: "example.com",
};

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    title: "Hello World",
    date: "2026-08-10T12:00:00-07:00",
    tags: ["TypeScript", "Bun"],
    tagSlugs: {},
    content: "hello from bunki",
    slug: "hello-world",
    url: "/2026/hello-world/",
    excerpt: "hello",
    html: '<p>hello</p><img src="/images/hello.webp">',
    ...overrides,
  };
}

describe("createSiteModel", () => {
  test("enriches posts without mutating parser output", () => {
    const post = createPost();
    const site = createSiteModel([post], config, { typescript: "Typed JavaScript" });

    expect(post.tagSlugs).toEqual({});
    expect(post.image).toBeUndefined();
    expect(post.wordCount).toBeUndefined();

    expect(site.posts[0].tagSlugs).toEqual({ TypeScript: "typescript", Bun: "bun" });
    expect(site.posts[0].image).toBe("https://example.com/images/hello.webp");
    expect(site.posts[0].wordCount).toBe(3);
    expect(site.posts[0].jsonLd).toContain("BlogPosting");
    expect(site.tags.TypeScript.description).toBe("Typed JavaScript");
  });

  test("groups tags and years", () => {
    const second = createPost({
      title: "Older",
      date: "2025-01-02T12:00:00-08:00",
      slug: "older",
      url: "/2025/older/",
      tags: ["Bun"],
    });
    const site = createSiteModel([createPost(), second], config);

    expect(site.tags.Bun.count).toBe(2);
    expect(site.tags.TypeScript.count).toBe(1);
    expect(site.postsByYear["2026"]).toHaveLength(1);
    expect(site.postsByYear["2025"]).toHaveLength(1);
  });
});

describe("groupPostsByYear", () => {
  test("does not require mutable input", () => {
    const posts: readonly Post[] = [createPost()];
    expect(groupPostsByYear(posts)["2026"]).toHaveLength(1);
  });
});
