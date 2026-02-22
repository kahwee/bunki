import { expect, test, describe, beforeEach } from "bun:test";
import {
  extractExcerpt,
  convertMarkdownToHtml,
  setNoFollowExceptions,
  createMarked,
} from "../../../src/utils/markdown/parser";
import type { CDNConfig } from "../../../src/types";

describe("Markdown Parser", () => {
  // Reset nofollow exceptions before each test
  beforeEach(() => {
    setNoFollowExceptions([]);
  });
  describe("extractExcerpt", () => {
    test("should create plain text excerpt", () => {
      const markdown = `
# Heading

This is a **bold** paragraph with [a link](https://example.com).

\`\`\`javascript
const x = 1;
\`\`\`

Another paragraph with *italic* text.
      `;

      const excerpt = extractExcerpt(markdown, 100);

      expect(excerpt).not.toInclude("#");
      expect(excerpt).not.toInclude("**");
      expect(excerpt).not.toInclude("[a link]");
      expect(excerpt).not.toInclude("```");
      expect(excerpt).not.toInclude("const x = 1");
      expect(excerpt).toInclude("This is a bold paragraph with a link");
    });

    test("should truncate to max length", () => {
      const longText =
        "This is a very long text that exceeds the maximum length and should be truncated at some point.";
      const excerpt = extractExcerpt(longText, 30);

      expect(excerpt.length).toBeLessThan(35);
      expect(excerpt).toEndWith("...");
    });

    test("should not truncate if within max length", () => {
      const shortText = "Short text";
      const excerpt = extractExcerpt(shortText, 100);

      expect(excerpt).toBe(shortText);
      expect(excerpt).not.toInclude("...");
    });

    test("should handle empty content", () => {
      const excerpt = extractExcerpt("");
      expect(excerpt).toBe("");
    });
  });

  describe("convertMarkdownToHtml", () => {
    test("should convert basic markdown to HTML", () => {
      const markdown = `# Heading\n\nThis is **bold** and *italic*.`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude("<h1>Heading</h1>");
      expect(html).toInclude("<strong>bold</strong>");
      expect(html).toInclude("<em>italic</em>");
    });

    test("should highlight code blocks", () => {
      const markdown = `
\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`
      `;

      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude("<pre>");
      expect(html).toInclude("<code class=");
      expect(html).toInclude("hljs");
      expect(html).toInclude("const");
    });

    test("should add lazy loading to images", () => {
      const markdown = `![Alt text](image.jpg)`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude("<img");
      expect(html).toInclude('loading="lazy"');
    });

    test("should add nofollow to external links by default", () => {
      const markdown = `[External](https://example.com)`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude('rel="noopener noreferrer nofollow"');
      expect(html).toInclude('target="_blank"');
    });

    test("should sanitize dangerous HTML", () => {
      const markdown = `<script>alert('xss')</script>`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).not.toInclude("<script>");
      expect(html).not.toInclude("alert");
    });

    test("should remove javascript: protocol", () => {
      const markdown = `[Click](javascript:alert('xss'))`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).not.toInclude("javascript:");
    });

    test("should convert YouTube links to embeds", () => {
      const markdown = `[Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude('<div class="video-container">');
      expect(html).toInclude("<iframe");
      expect(html).toInclude('src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
      expect(html).toInclude('loading="lazy"');
    });

    test("should preserve video tags", () => {
      const markdown = `
<video controls width="640">
  <source src="video.mp4" type="video/mp4">
</video>
      `;

      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude("<video");
      expect(html).toInclude("<source");
      expect(html).toInclude('src="video.mp4"');
    });

    test("should support GitHub alerts", () => {
      const markdown = `
> [!NOTE]
> This is a note.
      `;

      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude('class="markdown-alert');
      expect(html).toInclude("markdown-alert-note");
    });
  });

  describe("CDN image transformation", () => {
    test("should transform relative image paths to CDN URLs", () => {
      const cdnConfig: CDNConfig = {
        enabled: true,
        baseUrl: "https://cdn.example.com",
        pathPattern: "{year}/{slug}/{filename}",
      };

      const markdown = `![Image](../../assets/2025/my-post/photo.jpg)`;
      const html = convertMarkdownToHtml(markdown, cdnConfig);

      expect(html).toInclude("https://cdn.example.com/2025/my-post/photo.jpg");
      expect(html).not.toInclude("../../assets/");
    });

    test("should not transform non-asset paths", () => {
      const cdnConfig: CDNConfig = {
        enabled: true,
        baseUrl: "https://cdn.example.com",
        pathPattern: "{year}/{slug}/{filename}",
      };

      const markdown = `![Image](https://other-cdn.com/image.jpg)`;
      const html = convertMarkdownToHtml(markdown, cdnConfig);

      expect(html).toInclude("https://other-cdn.com/image.jpg");
      expect(html).not.toInclude("cdn.example.com");
    });

    test("should skip CDN transformation when disabled", () => {
      const cdnConfig: CDNConfig = {
        enabled: false,
        baseUrl: "https://cdn.example.com",
        pathPattern: "{year}/{slug}/{filename}",
      };

      const markdown = `![Image](../../assets/2025/my-post/photo.jpg)`;
      const html = convertMarkdownToHtml(markdown, cdnConfig);

      expect(html).toInclude("../../assets/2025/my-post/photo.jpg");
      expect(html).not.toInclude("cdn.example.com");
    });
  });

  describe("setNoFollowExceptions", () => {
    test("should allow following links to exception domains", () => {
      setNoFollowExceptions(["trusted-site.com"]);

      const markdown = `[Trusted](https://trusted-site.com)`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).toInclude('rel="noopener noreferrer"');
      expect(html).not.toInclude("nofollow");
    });

    test("should normalize www subdomain", () => {
      setNoFollowExceptions(["example.com"]);

      const markdown = `[Link](https://www.example.com)`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).not.toInclude("nofollow");
    });

    test("should handle case insensitivity", () => {
      setNoFollowExceptions(["Example.COM"]);

      const markdown = `[Link](https://example.com)`;
      const html = convertMarkdownToHtml(markdown);

      expect(html).not.toInclude("nofollow");
    });

    test("should reset exceptions list", () => {
      setNoFollowExceptions(["trusted.com"]);
      setNoFollowExceptions(["other-trusted.com"]);

      const markdown = `[Old](https://trusted.com)`;
      const html = convertMarkdownToHtml(markdown);

      // Should have nofollow since we reset the list
      expect(html).toInclude("nofollow");
    });
  });

  describe("createMarked", () => {
    test("should return Marked instance", () => {
      const marked = createMarked();
      expect(marked).toBeDefined();
      expect(marked.parse).toBeFunction();
    });

    test("should create instance with CDN config", () => {
      const cdnConfig: CDNConfig = {
        enabled: true,
        baseUrl: "https://cdn.example.com",
        pathPattern: "{year}/{slug}/{filename}",
      };

      const marked = createMarked(cdnConfig);
      expect(marked).toBeDefined();
    });
  });
});
