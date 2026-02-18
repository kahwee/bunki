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
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("file_not_found");
    expect(result.error?.file).toBe("/non/existent/file.md");
  });

  test("parseMarkdownFile should parse a markdown file", async () => {
    const result = await parseMarkdownFile(SAMPLE_FILE);

    expect(result.post).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.post).toHaveProperty("title");
    expect(result.post).toHaveProperty("date");
    expect(result.post).toHaveProperty("tags");
    expect(result.post).toHaveProperty("content");
    expect(result.post).toHaveProperty("html");
    expect(result.post).toHaveProperty("slug");
    expect(result.post).toHaveProperty("url");
    expect(result.post).toHaveProperty("excerpt");
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

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("missing_field");

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

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("missing_field");

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

    const result = await parseMarkdownFile(testFile);
    expect(result.post?.slug).toBe("my-custom-slug");

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

    const result = await parseMarkdownFile(testFile);
    expect(result.post?.excerpt).toBeDefined();
    expect(result.post?.excerpt).toInclude("This is a test post");

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

    const result = await parseMarkdownFile(testFile);
    expect(result.post?.excerpt).toBe("Custom excerpt here");

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

describe("GitHub-style Markdown Alerts", () => {
  test("should render NOTE alert", () => {
    const markdown = `> [!NOTE]
> This is a note.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("markdown-alert");
    expect(html).toInclude("markdown-alert-note");
    expect(html).toInclude("This is a note");
  });

  test("should render TIP alert", () => {
    const markdown = `> [!TIP]
> This is a tip.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("markdown-alert");
    expect(html).toInclude("markdown-alert-tip");
    expect(html).toInclude("This is a tip");
  });

  test("should render IMPORTANT alert", () => {
    const markdown = `> [!IMPORTANT]
> This is important.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("markdown-alert");
    expect(html).toInclude("markdown-alert-important");
    expect(html).toInclude("This is important");
  });

  test("should render WARNING alert", () => {
    const markdown = `> [!WARNING]
> This is a warning.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("markdown-alert");
    expect(html).toInclude("markdown-alert-warning");
    expect(html).toInclude("This is a warning");
  });

  test("should render CAUTION alert", () => {
    const markdown = `> [!CAUTION]
> This is a caution.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("markdown-alert");
    expect(html).toInclude("markdown-alert-caution");
    expect(html).toInclude("This is a caution");
  });

  test("should include SVG icon in alerts", () => {
    const markdown = `> [!NOTE]
> Alert with icon.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("<svg");
    expect(html).toInclude("</svg>");
  });

  test("should handle multi-line alert content", () => {
    const markdown = `> [!TIP]
> First line.
> Second line.`;
    const html = convertMarkdownToHtml(markdown);

    expect(html).toInclude("markdown-alert-tip");
    expect(html).toInclude("First line");
    expect(html).toInclude("Second line");
  });
});

describe("Business Location Validation", () => {
  test("should reject business location without type field", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz1");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-type.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - name: "Test Business"
    address: "123 Main St, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toInclude("type");
    expect(result.error?.suggestion).toInclude("type: Restaurant");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should reject business location without name field", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz2");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-name.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Restaurant
    address: "123 Main St, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toInclude("name");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should accept business location without address field (address is optional)", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz3");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-address.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Restaurant
    name: "Test Business"
    lat: 47.6062
    lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.post?.business).toBeDefined();
    expect(result.post?.business?.type).toBe("Restaurant");
    expect(result.post?.business?.name).toBe("Test Business");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should reject business location without coordinates", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz4");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "no-coords.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Restaurant
    name: "Test Business"
    address: "123 Main St, City, ST 12345"
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toInclude("coordinates");
    expect(result.error?.suggestion).toInclude("lat:");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should accept valid business location with lat/lng", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz5");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "valid-latlng.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Restaurant
    name: "Test Business"
    address: "123 Main St, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.post?.business).toBeDefined();
    expect(result.post?.business?.type).toBe("Restaurant");
    expect(result.post?.business?.name).toBe("Test Business");
    expect(result.post?.business?.address).toBe("123 Main St, City, ST 12345");
    expect(result.post?.business?.lat).toBe(47.6062);
    expect(result.post?.business?.lng).toBe(-122.3321);

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should reject business location with deprecated latitude/longitude", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz6");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "deprecated-latlong.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Museum
    name: "Test Museum"
    address: "456 Museum Ave, City, ST 12345"
    latitude: 47.6062
    longitude: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toContain("lat");
    expect(result.error?.message).toContain("lng");
    expect(result.error?.suggestion).toContain("Replace");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should validate multiple business locations", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz7");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "multi-biz.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Restaurant
    name: "First Business"
    address: "123 Main St, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
  - type: Museum
    address: "456 Museum Ave, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toInclude("location 2");
    expect(result.error?.message).toInclude("name");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should accept multiple valid business locations", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz8");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "multi-biz-valid.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: Restaurant
    name: "First Business"
    address: "123 Main St, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
  - type: Museum
    name: "Second Business"
    address: "456 Museum Ave, City, ST 12345"
    lat: 47.6000
    lng: -122.3400
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).not.toBeNull();
    expect(result.error).toBeNull();

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should reject deprecated location field", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz9");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "deprecated-location.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
location:
  type: Museum
  name: "Test Museum"
  address: "456 Museum Ave, City, ST 12345"
  lat: 47.6062
  lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toContain("business");
    expect(result.error?.message).toContain("location");
    expect(result.error?.suggestion).toContain("Replace");

    await fs.promises.rm(testDir, { recursive: true });
  });

  test("should reject invalid business type", async () => {
    const testDir = path.join(import.meta.dir, "markdown-test-temp-biz10");
    await fs.promises.mkdir(testDir, { recursive: true });

    const testFile = path.join(testDir, "invalid-type.md");
    await fs.promises.writeFile(
      testFile,
      `---
title: Test Location
date: 2025-01-01T00:00:00Z
tags: [test]
business:
  - type: InvalidType
    name: "Test Business"
    address: "123 Main St, City, ST 12345"
    lat: 47.6062
    lng: -122.3321
---

Content here`,
    );

    const result = await parseMarkdownFile(testFile);
    expect(result.post).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.type).toBe("validation");
    expect(result.error?.message).toContain("Invalid business type");
    expect(result.error?.message).toContain("InvalidType");
    expect(result.error?.suggestion).toContain("Schema.org");

    await fs.promises.rm(testDir, { recursive: true });
  });
});
