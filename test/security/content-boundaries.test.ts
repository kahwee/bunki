import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateRSSFeed, generateSitemapIndex } from "../../src/generators/feeds";
import { startServer } from "../../src/server";
import { createSiteModel } from "../../src/site-model";
import type { Post, SiteConfig } from "../../src/types";
import { convertMarkdownToHtml } from "../../src/utils/markdown/parser";
import { uploadImages } from "../../src/utils/image-uploader";
import { S3Uploader } from "../../src/utils/s3-uploader";
import { buildRSSItem, buildSitemapUrl } from "../../src/utils/xml-builder";

const config: SiteConfig = {
  title: "Test",
  description: "Test",
  domain: "example.com",
  baseUrl: "https://example.com",
};
function post(url = "/2026/hello/", tags = ["Bun"]): Post {
  return {
    title: "Hello",
    date: "2026-08-10T12:00:00-07:00",
    tags,
    tagSlugs: {},
    content: "Hello",
    slug: "hello",
    url,
    excerpt: "Hello",
    html: "<p>Hello</p>",
  };
}

describe("content trust boundaries", () => {
  test("rejects duplicate final routes regardless of source filename or date", () => {
    expect(() =>
      createSiteModel([post(), { ...post(), date: "2026-09-10T12:00:00-07:00" }], config),
    ).toThrow("Conflicting post route");
  });
  test("rejects colliding and empty tag slugs, and safely handles object property names", () => {
    expect(() => createSiteModel([post("/2026/a/", ["C++", "C"])], config)).toThrow("tag slug");
    expect(() => createSiteModel([post("/2026/a/", ["!!!"])], config)).toThrow("tag slug");
    expect(
      createSiteModel([post("/2026/a/", ["constructor"])], config).tags.constructor.count,
    ).toBe(1);
  });
  test("limits active iframe sources to HTTPS video provider hosts", () => {
    for (const source of [
      "https://evil.example/embed/a",
      "/account",
      "//www.youtube.com/embed/a",
      "http://www.youtube.com/embed/a",
      "https://www.youtube.com.evil.example/embed/a",
    ]) {
      expect(convertMarkdownToHtml(`<iframe src="${source}"></iframe>`)).not.toContain(
        `src="${source}"`,
      );
    }
    expect(
      convertMarkdownToHtml('<iframe src="https://www.youtube.com/embed/a"></iframe>'),
    ).toContain('src="https://www.youtube.com/embed/a"');
  });
  test("escapes XML text and attributes and splits CDATA terminators", () => {
    const payload = ']]><injected x="1">&';
    const item = buildRSSItem({
      title: payload,
      description: payload,
      content: payload,
      link: payload,
      author: payload,
      pubDate: payload,
    });
    expect(item).toContain("]]]]><![CDATA[><injected");
    expect(item).not.toContain("<author>]]><injected");
    expect(item).toContain("<link>]]&gt;&lt;injected x=&quot;1&quot;&gt;&amp;</link>");
    expect(buildSitemapUrl(payload, payload, payload, 1)).not.toContain("<loc>]]><injected");
    const maliciousConfig = {
      ...config,
      title: payload,
      description: payload,
      copyright: payload,
      authorEmail: payload,
      authorName: payload,
      webMaster: payload,
      rssLanguage: payload,
      baseUrl: payload,
    };
    const feed = generateRSSFeed(createSiteModel([], config), maliciousConfig);
    expect(feed).toContain("<title><![CDATA[]]]]><![CDATA[><injected");
    expect(feed).not.toContain("<language>]]><injected");
    expect(feed).toContain('href="]]&gt;&lt;injected x=&quot;1&quot;&gt;&amp;/feed.xml"');
    expect(generateSitemapIndex(maliciousConfig)).toContain("<loc>]]&gt;&lt;injected");
  });
  test("preview binds loopback and refuses file and directory symlink escapes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bunki-preview-security-"));
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      const output = path.join(root, "output");
      await mkdir(output);
      await mkdir(path.join(root, "private"));
      await writeFile(path.join(root, "private", "index.html"), "SECRET");
      await writeFile(path.join(output, "index.html"), "PUBLIC");
      await symlink(path.join(root, "private", "index.html"), path.join(output, "secret.html"));
      await symlink(path.join(root, "private"), path.join(output, "escape"));
      await symlink(path.join(output, "index.html"), path.join(output, "inside.html"));
      server = await startServer(output, 0);
      expect(server.hostname).toBe("127.0.0.1");
      const base = `http://127.0.0.1:${server.port}`;
      for (const route of ["/secret.html", "/escape/", "/escape/index.html"]) {
        expect((await fetch(base + route)).status).toBe(404);
      }
      expect(await (await fetch(`${base}/inside.html`)).text()).toBe("PUBLIC");
    } finally {
      server?.stop(true);
      await rm(root, { recursive: true, force: true });
    }
  });
  test("content-assets selects only the configured year asset directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bunki-content-assets-security-"));
    const previousDryRun = process.env.BUNKI_DRY_RUN;
    process.env.BUNKI_DRY_RUN = "true";
    try {
      for (const file of [
        "2026/media/same.png",
        "2026/same.png",
        "2026/other/media/same.png",
        "other/media/same.png",
      ]) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), "image");
      }
      const urls = await uploadImages({
        images: root,
        contentAssets: true,
        contentAssetsDir: "media",
      });
      expect(Object.keys(urls)).toEqual(["2026/same.png"]);
      await expect(
        uploadImages({ images: root, contentAssets: true, contentAssetsDir: "../media" }),
      ).rejects.toThrow("single directory name");
    } finally {
      if (previousDryRun === undefined) delete process.env.BUNKI_DRY_RUN;
      else process.env.BUNKI_DRY_RUN = previousDryRun;
      await rm(root, { recursive: true, force: true });
    }
  });
  test("preflights all transformed upload keys before any writes and filters selected files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bunki-upload-security-"));
    try {
      await mkdir(path.join(root, "2026", "_assets"), { recursive: true });
      await writeFile(path.join(root, "2026", "_assets", "same.png"), "asset");
      await writeFile(path.join(root, "2026", "same.png"), "other");
      const uploader = new S3Uploader({
        bucket: "test",
        publicUrl: "https://example.com",
        accessKeyId: "test",
        secretAccessKey: "test",
      });
      let writes = 0;
      Object.assign(uploader, {
        client: {
          file: () => ({
            write: async () => {
              writes++;
              return 0;
            },
          }),
        },
      });
      const transform = (file: string) => file.replace("/_assets/", "/");
      await expect(uploader.uploadImages(root, undefined, transform)).rejects.toThrow(
        "Conflicting upload key",
      );
      expect(writes).toBe(0);
      const urls = await uploader.uploadImages(root, undefined, transform, undefined, (file) =>
        file.startsWith("2026/_assets/"),
      );
      expect(Object.keys(urls)).toEqual(["2026/same.png"]);
      expect(writes).toBe(process.env.BUNKI_DRY_RUN === "true" ? 0 : 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
