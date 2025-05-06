import { expect, test, describe } from "bun:test";
import { 
  extractExcerpt,
  convertMarkdownToHtml,
  parseMarkdownFile
} from "../../src/utils/markdown-utils";
import path from "path";

const FIXTURES_DIR = path.join(import.meta.dir, "../../fixtures");
const SAMPLE_FILE = path.join(FIXTURES_DIR, "content", "2024", "test-post-1.md");

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
    expect(html).toInclude("<a href=\"https://example.com\"");
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
});