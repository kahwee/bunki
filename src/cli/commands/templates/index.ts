/**
 * Default templates for bunki init command
 */
import { baseNjk } from "./base-njk";
import { indexNjk } from "./index-njk";
import { postNjk } from "./post-njk";
import { tagNjk } from "./tag-njk";
import { tagsNjk } from "./tags-njk";
import { archiveNjk } from "./archive-njk";
import { defaultCss } from "./default-css";
import { samplePost } from "./sample-post";

/**
 * Nunjucks template files
 */
export const nunjucks: Record<string, string> = {
  "base.njk": baseNjk,
  "index.njk": indexNjk,
  "post.njk": postNjk,
  "tag.njk": tagNjk,
  "tags.njk": tagsNjk,
  "archive.njk": archiveNjk,
};

/**
 * Default CSS stylesheet
 */
export { defaultCss };

/**
 * Sample markdown post
 */
export { samplePost };
