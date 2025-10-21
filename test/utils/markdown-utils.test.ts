import { expect, test, describe, beforeEach } from "bun:test";
import {
  extractExcerpt,
  convertMarkdownToHtml,
  parseMarkdownFile,
  setNoFollowExceptions,
} from "../../src/utils/markdown-utils";
import path from "path";
import fs from "fs";

const FIXTURES_DIR = path.join(import.meta.dir, "../../fixtures");
const SAMPLE_FILE = path.join(
  FIXTURES_DIR,
  "content",
  "2025",
  "test-post-1.md",
);

describe("Markdown Utilities", () => {
  test("extractExcerpt should create a plain text excerpt", () => {
    const markdown = `
# Heading

This is a **bold** paragraph with [a link](https://example.com).

\`\`\`javascript
// This code should be removed
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

    // Test truncation
    const shortExcerpt = extractExcerpt(markdown, 20);
    expect(shortExcerpt.length).toBeLessThan(25); // Allow for "..." at the end
    expect(shortExcerpt).toEndWith("...");
  });

  test("convertMarkdownToHtml should convert markdown to HTML", () => {
    const markdown = `
# Heading

This is a **bold** paragraph with [a link](https://example.com).

\`\`\`javascript
// Code block
const x = 1;
\`\`\`
    `;

    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<h1>Heading</h1>");
    expect(html).toInclude("<strong>bold</strong>");
    expect(html).toInclude('<a href="https://example.com"');
    expect(html).toInclude("<pre>");
    expect(html).toInclude("<code class=");
    expect(html).toInclude("const");
  });

  test("parseMarkdownFile should handle non-existent files", async () => {
    const result = await parseMarkdownFile("/non/existent/file.md");
    expect(result).toBeNull();
  });

  test("parseMarkdownFile should parse a markdown file", async () => {
    const post = await parseMarkdownFile(SAMPLE_FILE);

    expect(post).not.toBeNull();
    expect(post).toHaveProperty("title");
    expect(post).toHaveProperty("date");
    expect(post).toHaveProperty("tags");
    expect(post).toHaveProperty("content");
    expect(post).toHaveProperty("html");
    expect(post).toHaveProperty("slug");
    expect(post).toHaveProperty("url");
    expect(post).toHaveProperty("excerpt");
  });

  test("convertMarkdownToHtml should preserve video tags", () => {
    const markdown = `
<video controls width="640" height="360" poster="thumbnail.jpg">
  <source src="video.mp4" type="video/mp4">
  <source src="video.webm" type="video/webm">
  Your browser does not support the video tag.
</video>
    `;

    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<video");
    expect(html).toInclude("controls");
    expect(html).toInclude('width="640"');
    expect(html).toInclude('height="360"');
    expect(html).toInclude('poster="thumbnail.jpg"');
    expect(html).toInclude("<source");
    expect(html).toInclude('src="video.mp4"');
    expect(html).toInclude('type="video/mp4"');
  });

  test("convertMarkdownToHtml should preserve video tag with src attribute", () => {
    const markdown = `
<video src="video.mp4" controls muted loop></video>
    `;

    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<video");
    expect(html).toInclude('src="video.mp4"');
    expect(html).toInclude("controls");
    expect(html).toInclude("muted");
    expect(html).toInclude("loop");
  });

  test("convertMarkdownToHtml should sanitize dangerous video attributes", () => {
    const markdown = `
<video src="video.mp4" controls onclick="alert('xss')"></video>
    `;

    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<video");
    expect(html).toInclude('src="video.mp4"');
    expect(html).toInclude("controls");
    expect(html).not.toInclude("onclick");
    expect(html).not.toInclude("alert");
  });

  test("convertMarkdownToHtml should add lazy loading to images", () => {
    const markdown = `![Alt text](image.jpg)`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<img");
    expect(html).toInclude('loading="lazy"');
    expect(html).toInclude('src="image.jpg"');
  });

  test("convertMarkdownToHtml should convert YouTube links to embedded videos", () => {
    const youtubeMarkdown =
      "[Watch this](https://www.youtube.com/watch?v=dQw4w9WgXcQ)";
    const html = convertMarkdownToHtml(youtubeMarkdown);

    expect(html).toInclude("<iframe");
    expect(html).toInclude('src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
    expect(html).toInclude("video-container");
  });

  test("convertMarkdownToHtml should handle short YouTube URLs", () => {
    const youtubeMarkdown = "[Watch](https://youtu.be/dQw4w9WgXcQ)";
    const html = convertMarkdownToHtml(youtubeMarkdown);

    expect(html).toInclude("<iframe");
    expect(html).toInclude('src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
  });

  test("convertMarkdownToHtml should add noopener noreferrer to external links", () => {
    const markdown = "[External](https://example.com)";
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude('rel="noopener noreferrer nofollow"');
    expect(html).toInclude('target="_blank"');
  });

  test("convertMarkdownToHtml should add nofollow to external domains by default", () => {
    setNoFollowExceptions([]); // Reset exceptions
    const markdown = "[Example](https://example.com)";
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("nofollow");
  });

  test("convertMarkdownToHtml should respect nofollow exceptions", () => {
    setNoFollowExceptions(["example.com", "github.com"]);
    const markdown = "[Example](https://example.com)";
    const html = convertMarkdownToHtml(markdown);

    // Should NOT have nofollow for exception domain
    expect(html).not.toInclude('rel="noopener noreferrer nofollow"');
    expect(html).toInclude('rel="noopener noreferrer"');
  });

  test("convertMarkdownToHtml should strip www from domain in exceptions", () => {
    setNoFollowExceptions(["www.example.com"]);
    const markdown = "[Link](https://example.com)";
    const html = convertMarkdownToHtml(markdown);

    // Should NOT have nofollow because www.example.com matches example.com
    expect(html).not.toInclude("nofollow");
  });

  test("convertMarkdownToHtml should sanitize XSS attempts in markdown links", () => {
    const xssMarkdown = '[Click me](javascript:alert("XSS"))';
    const html = convertMarkdownToHtml(xssMarkdown);

    expect(html).not.toInclude("javascript:");
    expect(html).not.toInclude("alert");
  });

  test("convertMarkdownToHtml should sanitize XSS attempts in HTML content", () => {
    const xssMarkdown = '<img src="x" onerror="alert(\'XSS\')">';
    const html = convertMarkdownToHtml(xssMarkdown);

    expect(html).not.toInclude("onerror");
    expect(html).not.toInclude("alert");
  });

  test("extractExcerpt should handle exact max length", () => {
    const content = "Hello world";
    const excerpt = extractExcerpt(content, 11);

    expect(excerpt).toBe("Hello world");
  });

  test("extractExcerpt should handle single word longer than max", () => {
    const content = "Supercalifragilisticexpialidocious";
    const excerpt = extractExcerpt(content, 5);

    expect(excerpt).toInclude("...");
  });

  test("extractExcerpt should handle multiple paragraphs", () => {
    const markdown = `
First paragraph with text.

Second paragraph here.

Third paragraph.
    `;
    const excerpt = extractExcerpt(markdown);

    expect(excerpt).toInclude("First paragraph");
    expect(excerpt).not.toInclude("```");
  });

  test("extractExcerpt should remove multiple code blocks", () => {
    const markdown = `
\`\`\`js
code1
\`\`\`

Text here

\`\`\`py
code2
\`\`\`
    `;
    const excerpt = extractExcerpt(markdown);

    expect(excerpt).not.toInclude("code1");
    expect(excerpt).not.toInclude("code2");
    expect(excerpt).toInclude("Text here");
  });

  test("convertMarkdownToHtml should support multiple code languages", () => {
    const markdown = `
\`\`\`typescript
const x: string = "hello";
\`\`\`

\`\`\`python
print("hello")
\`\`\`

\`\`\`json
{"key": "value"}
\`\`\`
    `;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("hljs");
    expect(html).toInclude("const");
    expect(html).toInclude("print");
    expect(html).toInclude("key");
  });

  test("convertMarkdownToHtml should handle lists", () => {
    const markdown = `
- Item 1
- Item 2
- Item 3

1. Ordered item 1
2. Ordered item 2
    `;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<li>");
    expect(html).toInclude("<ul>");
    expect(html).toInclude("<ol>");
  });

  test("convertMarkdownToHtml should handle multiple heading levels", () => {
    const markdown = `
# H1
## H2
### H3
#### H4
##### H5
###### H6
    `;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<h1>");
    expect(html).toInclude("<h2>");
    expect(html).toInclude("<h3>");
    expect(html).toInclude("<h4>");
    expect(html).toInclude("<h5>");
    expect(html).toInclude("<h6>");
  });

  test("convertMarkdownToHtml should handle blockquotes", () => {
    const markdown = `
> This is a quote
> spanning multiple lines
    `;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<blockquote>");
    expect(html).toInclude("This is a quote");
  });

  test("convertMarkdownToHtml should handle inline code", () => {
    const markdown = "Use `const x = 1` to declare a variable";
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<code>");
    expect(html).toInclude("const x = 1");
  });
});

describe("Markdown Utilities - Edge Cases", () => {
  test("parseMarkdownFile should handle missing title", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-title.md");
    await fs.promises.writeFile(
      testFile,
      `---
date: 2025-01-01T00:00:00Z
tags: [test]
---

Content here`,
    );

    const post = await parseMarkdownFile(testFile);
    expect(post).toBeNull();

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("parseMarkdownFile should handle missing date", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp2");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-date.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Post
tags: [test]
---

Content here`,
    );

    const post = await parseMarkdownFile(testFile);
    expect(post).toBeNull();

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("parseMarkdownFile should use custom slug when provided", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp3");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "custom-slug.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Post
date: 2025-01-01T00:00:00Z
slug: my-custom-slug
tags: [test]
---

Content here`,
    );

    const post = await parseMarkdownFile(testFile);
    expect(post?.slug).toBe("my-custom-slug");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("parseMarkdownFile should use default excerpt when not provided", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp4");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-excerpt.md");
    const content =
      "This is a test post with some content that should be excerpted automatically.";
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Post
date: 2025-01-01T00:00:00Z
tags: [test]
---

${content}`,
    );

    const post = await parseMarkdownFile(testFile);
    expect(post?.excerpt).toBeDefined();
    expect(post?.excerpt).toInclude("This is a test post");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("parseMarkdownFile should use custom excerpt when provided", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp5");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "custom-excerpt.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Post
date: 2025-01-01T00:00:00Z
excerpt: "Custom excerpt here"
tags: [test]
---

Content here`,
    );

    const post = await parseMarkdownFile(testFile);
    expect(post?.excerpt).toBe("Custom excerpt here");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("convertMarkdownToHtml should handle table markup", () => {
    const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
    `;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<table>");
    expect(html).toInclude("<tr>");
    expect(html).toInclude("<td>");
  });
});
