import { expect, test, describe } from "bun:test";
import {
  escapeXml,
  buildSitemapUrl,
  calculateFreshnessPriority,
  buildRSSItem,
} from "../../src/utils/xml-builder";

describe("XML Builder Utilities", () => {
  describe("escapeXml", () => {
    test("should escape special XML characters", () => {
      expect(escapeXml("Hello & World")).toBe("Hello &amp; World");
      expect(escapeXml("<script>")).toBe("&lt;script&gt;");
      expect(escapeXml('Say "hello"')).toBe("Say &quot;hello&quot;");
      expect(escapeXml("It's great")).toBe("It&apos;s great");
    });

    test("should handle multiple special characters", () => {
      const input = '<tag attr="value" & more>';
      const expected = "&lt;tag attr=&quot;value&quot; &amp; more&gt;";
      expect(escapeXml(input)).toBe(expected);
    });

    test("should handle empty string", () => {
      expect(escapeXml("")).toBe("");
    });
  });

  describe("buildSitemapUrl", () => {
    test("should build valid sitemap URL entry", () => {
      const xml = buildSitemapUrl(
        "https://example.com/page",
        "2025-01-15T10:00:00Z",
        "weekly",
        0.8,
      );

      expect(xml).toInclude("<loc>https://example.com/page</loc>");
      expect(xml).toInclude("<lastmod>2025-01-15T10:00:00Z</lastmod>");
      expect(xml).toInclude("<changefreq>weekly</changefreq>");
      expect(xml).toInclude("<priority>0.8</priority>");
      expect(xml).toInclude("<url>");
      expect(xml).toInclude("</url>");
    });

    test("should format priority to one decimal place", () => {
      const xml = buildSitemapUrl(
        "https://example.com/",
        "2025-01-15T10:00:00Z",
        "daily",
        0.75432,
      );

      expect(xml).toInclude("<priority>0.8</priority>");
    });
  });

  describe("calculateFreshnessPriority", () => {
    test("should boost priority for very recent content (< 1 week)", () => {
      const now = Date.now();
      const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

      const priority = calculateFreshnessPriority(twoDaysAgo, 0.5, now);
      expect(priority).toBe(0.7); // 0.5 + 0.2
    });

    test("should moderately boost recent content (< 1 month)", () => {
      const now = Date.now();
      const twoWeeksAgo = new Date(
        now - 14 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const priority = calculateFreshnessPriority(twoWeeksAgo, 0.5, now);
      expect(priority).toBe(0.6); // 0.5 + 0.1
    });

    test("should not boost old content", () => {
      const now = Date.now();
      const twoMonthsAgo = new Date(
        now - 60 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const priority = calculateFreshnessPriority(twoMonthsAgo, 0.5, now);
      expect(priority).toBe(0.5); // No boost
    });

    test("should cap priority at 1.0", () => {
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      const priority = calculateFreshnessPriority(yesterday, 0.9, now);
      expect(priority).toBe(1.0); // Capped at 1.0
    });
  });

  describe("buildRSSItem", () => {
    test("should build basic RSS item", () => {
      const xml = buildRSSItem({
        title: "Test Post",
        link: "https://example.com/test",
        pubDate: "Mon, 15 Jan 2025 10:00:00 GMT",
        description: "Test description",
        content: "<p>Test content</p>",
      });

      expect(xml).toInclude("<title><![CDATA[Test Post]]></title>");
      expect(xml).toInclude("<link>https://example.com/test</link>");
      expect(xml).toInclude(
        '<guid isPermaLink="true">https://example.com/test</guid>',
      );
      expect(xml).toInclude("<pubDate>Mon, 15 Jan 2025 10:00:00 GMT</pubDate>");
      expect(xml).toInclude(
        "<description><![CDATA[Test description]]></description>",
      );
      expect(xml).toInclude(
        "<content:encoded><![CDATA[<p>Test content</p>]]></content:encoded>",
      );
    });

    test("should include author when provided", () => {
      const xml = buildRSSItem({
        title: "Test Post",
        link: "https://example.com/test",
        pubDate: "Mon, 15 Jan 2025 10:00:00 GMT",
        description: "Test description",
        content: "<p>Test content</p>",
        author: "test@example.com (Test Author)",
      });

      expect(xml).toInclude("<author>test@example.com (Test Author)</author>");
    });

    test("should include tags as categories", () => {
      const xml = buildRSSItem({
        title: "Test Post",
        link: "https://example.com/test",
        pubDate: "Mon, 15 Jan 2025 10:00:00 GMT",
        description: "Test description",
        content: "<p>Test content</p>",
        tags: ["tech", "web-development"],
      });

      expect(xml).toInclude("<category>tech</category>");
      expect(xml).toInclude("<category>web-development</category>");
    });

    test("should include image with media tags", () => {
      const xml = buildRSSItem({
        title: "Test Post",
        link: "https://example.com/test",
        pubDate: "Mon, 15 Jan 2025 10:00:00 GMT",
        description: "Test description",
        content: "<p>Test content</p>",
        image: "https://example.com/image.jpg",
      });

      expect(xml).toInclude(
        '<media:thumbnail url="https://example.com/image.jpg" />',
      );
      expect(xml).toInclude(
        '<enclosure url="https://example.com/image.jpg" type="image/jpeg" length="0" />',
      );
      expect(xml).toInclude('<img src="https://example.com/image.jpg"');
    });

    test("should escape special characters in tags", () => {
      const xml = buildRSSItem({
        title: "Test Post",
        link: "https://example.com/test",
        pubDate: "Mon, 15 Jan 2025 10:00:00 GMT",
        description: "Test description",
        content: "<p>Test content</p>",
        tags: ["tech & software"],
      });

      expect(xml).toInclude("<category>tech &amp; software</category>");
    });
  });
});
