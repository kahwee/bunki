import slugify from "slugify";
import type { Post, Site, SiteConfig, TagData } from "./types";
import { getPacificYear } from "./utils/date-utils";
import { extractFirstImageUrl, generatePostPageSchemas, schemasToHtml } from "./utils/json-ld";

export function createSiteModel(
  posts: readonly Post[],
  config: SiteConfig,
  tagDescriptions: Readonly<Record<string, string>> = {},
): Site {
  const tags: Record<string, TagData> = {};
  const enrichedPosts = posts.map((post) => {
    const tagSlugs = Object.fromEntries(
      post.tags.map((tagName) => [tagName, slugify(tagName, { lower: true, strict: true })]),
    );
    const image = extractFirstImageUrl(post.html, config.baseUrl) ?? post.image;
    const wordCount = post.content ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;

    const enrichedPost: Post = {
      ...post,
      tagSlugs,
      ...(image ? { image } : {}),
      wordCount,
    };

    enrichedPost.jsonLd = schemasToHtml(
      generatePostPageSchemas({
        post: enrichedPost,
        site: config,
        imageUrl: enrichedPost.image,
      }),
    );

    return enrichedPost;
  });

  for (const post of enrichedPosts) {
    for (const tagName of post.tags) {
      const tagSlug = post.tagSlugs[tagName];
      const existing = tags[tagName];
      if (existing) {
        existing.count += 1;
        existing.posts.push(post);
        continue;
      }

      const description = tagDescriptions[tagName.toLowerCase()];
      tags[tagName] = {
        name: tagName,
        slug: tagSlug,
        count: 1,
        posts: [post],
        ...(description ? { description } : {}),
      };
    }
  }

  return {
    name: config.domain,
    posts: enrichedPosts,
    tags,
    postsByYear: groupPostsByYear(enrichedPosts),
  };
}

export function groupPostsByYear(posts: readonly Post[]): Record<string, Post[]> {
  const postsByYear: Record<string, Post[]> = {};

  for (const post of posts) {
    const year = getPacificYear(post.date).toString();
    if (!postsByYear[year]) postsByYear[year] = [];
    postsByYear[year].push(post);
  }

  return postsByYear;
}
