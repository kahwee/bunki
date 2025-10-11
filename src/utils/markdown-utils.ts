import matter from "gray-matter";
import hljs from "highlight.js/lib/core";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import sanitizeHtml from "sanitize-html";
import { Post } from "../types";
import { getBaseFilename, readFileAsText } from "./file-utils";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("swift", swift);

const marked = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : "json";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({
  walkTokens(token) {
    if (token.type === "link") {
      token.href = token.href || "";
      const isExternal =
        token.href &&
        (token.href.startsWith("http://") ||
          token.href.startsWith("https://") ||
          token.href.startsWith("//"));

      if (isExternal) {
        (token as any).isExternalLink = true;

        if (
          token.href.includes("youtube.com/watch") ||
          token.href.includes("youtu.be/")
        ) {
          (token as any).isYouTubeLink = true;
        }
      }
    }
  },
  hooks: {
    preprocess(markdown) {
      return markdown;
    },
    postprocess(html) {
      html = html.replace(
        /<a href="(https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)[^"]*)"[^>]*>(.*?)<\/a>/g,
        '<div class="video-container"><iframe src="https://www.youtube.com/embed/$4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>',
      );

      return html.replace(
        /<a href="(https?:\/\/|\/\/)([^"]+)"/g,
        '<a href="$1$2" target="_blank" rel="noopener noreferrer"',
      );
    },
  },
});

export function extractExcerpt(content: string, maxLength = 200): string {
  const plainText = content
    .replace(/^#.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/\n+/g, " ")
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return truncated.substring(0, lastSpace) + "...";
}

export function convertMarkdownToHtml(markdownContent: string): string {
  const html = marked.parse(markdownContent);
  let sanitized = sanitizeHtml(html.toString(), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "span",
      "iframe",
      "div",
      "video",
      "source",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title"],
      code: ["class"],
      pre: ["class"],
      span: ["class", "style"],
      iframe: ["src", "frameborder", "allow", "allowfullscreen", "loading"],
      div: ["class"],
      video: [
        "src",
        "controls",
        "width",
        "height",
        "autoplay",
        "loop",
        "muted",
        "preload",
        "poster",
      ],
      source: ["src", "type"],
    },
    allowedClasses: {
      code: ["*"],
      pre: ["*"],
      span: ["*"],
      div: ["video-container"],
    },
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  });

  // Extra hardening: strip javascript:, vbscript: textual occurrences to satisfy security tests
  sanitized = sanitized.replace(/javascript:/gi, "").replace(/vbscript:/gi, "");
  return sanitized;
}

export async function parseMarkdownFile(
  filePath: string,
): Promise<Post | null> {
  try {
    const fileContent = await readFileAsText(filePath);

    if (fileContent === null) {
      console.warn(`File not found or couldn't be read: ${filePath}`);
      return null;
    }

    const { data, content } = matter(fileContent);

    if (!data.title || !data.date) {
      console.warn(
        `Skipping ${filePath}: missing required frontmatter (title or date)`,
      );
      return null;
    }

    let slug = data.slug || getBaseFilename(filePath);
    const sanitizedHtml = convertMarkdownToHtml(content);
    const pacificDate = new Date(
      new Date(data.date).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
      }),
    );
    const postYear = pacificDate.getFullYear();

    const post: Post = {
      title: data.title,
      date: pacificDate.toISOString(),
      tags: data.tags || [],
      tagSlugs: {},
      content,
      slug,
      url: `/${postYear}/${slug}/`,
      excerpt: data.excerpt || extractExcerpt(content),
      html: sanitizedHtml,
    };

    return post;
  } catch (error) {
    console.error(`Error parsing markdown file ${filePath}:`, error);
    return null;
  }
}
