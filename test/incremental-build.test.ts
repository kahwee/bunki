import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SiteGenerator } from "../src/site-generator";
import type { GeneratorOptions } from "../src/types";
import { loadCache } from "../src/utils/build-cache";

let root: string;
let options: GeneratorOptions & { configFile: string };

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "bunki-incremental-test-"));
  options = {
    rootDir: root,
    configFile: path.join(root, "custom.config.ts"),
    contentDir: path.join(root, "content"),
    outputDir: path.join(root, "dist"),
    templatesDir: path.join(root, "templates"),
    config: {
      title: "Test",
      description: "Test site",
      baseUrl: "https://example.com",
      domain: "example.com",
      css: { enabled: false, input: "styles.css", output: "styles.css" },
    },
  };
  await Bun.write(options.configFile, "export default {};");
  for (const name of ["index", "post", "tags", "tag", "archive", "map", "404", "privacy"]) {
    await Bun.write(
      path.join(options.templatesDir, `${name}.njk`),
      "{{ post.html | safe }}{% for post in posts %}{{ post.title }};{% endfor %}",
    );
  }
  await writePost("a-old.md", "Old", "2024-01-01");
  await writePost("z-new.md", "New", "2026-01-01");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writePost(file: string, title: string, date: string, extra = "") {
  const filePath = path.join(options.contentDir, file);
  await Bun.write(
    filePath,
    `---\ntitle: ${title}\ndate: ${date}T12:00:00-08:00\ntags: [test]\n${extra}---\n\nHello **world**.`,
  );
  // Deliberately move the timestamp so tests don't depend on filesystem clock resolution.
  const next = new Date(Date.now() + title.length * 1000);
  await utimes(filePath, next, next);
  return filePath;
}

async function build(incremental = true) {
  const generator = new SiteGenerator(options);
  if (incremental) generator.enableIncrementalMode();
  await generator.initialize();
  await generator.generate();
  return Bun.file(path.join(options.outputDir, "index.html")).text();
}

describe("incremental builds", () => {
  test("match full builds after cache reuse and edits, with correct file/post pairing", async () => {
    const first = await build();
    expect(first).toBe("New;Old;");
    const cache = await loadCache(root);
    expect(cache.files[path.join(options.contentDir, "a-old.md")].post?.title).toBe("Old");
    expect(cache.files[path.join(options.contentDir, "z-new.md")].post?.title).toBe("New");
    expect(await build()).toBe(first);
    await writePost("a-old.md", "Newest", "2027-01-01");
    const edited = await build();
    expect(edited).toBe("Newest;New;");
    expect(await build(false)).toBe(edited);
  });

  test("reject strict parsing errors introduced after warming the cache", async () => {
    options.config.strictMode = true;
    await build();
    await Bun.write(
      path.join(options.contentDir, "invalid.md"),
      "---\ntitle: Missing Date\n---\nBody",
    );
    await expect(build()).rejects.toThrow("strictMode");
  });

  test("reject business validation errors and conflicting files on a warm cache", async () => {
    await build();
    const invalid = await writePost(
      "invalid.md",
      "Invalid",
      "2026-01-01",
      "business:\n  type: Restaurant\n",
    );
    await expect(build()).rejects.toThrow("validation error");
    await rm(invalid);
    await writePost("a-old/README.md", "Duplicate", "2024-01-01");
    await expect(build()).rejects.toThrow("validation error");
  });

  test("remove invalid and deleted posts from the cache without resurrecting them", async () => {
    await build();
    const file = path.join(options.contentDir, "a-old.md");
    await Bun.write(file, "---\ntitle: Missing Date\n---\nBody");
    await utimes(file, new Date(0), new Date(0));
    expect(await build()).toBe("New;");
    expect((await loadCache(root)).files[file]).toBeUndefined();
    await rm(file);
    expect(await build()).toBe("New;");
    expect((await loadCache(root)).files[file]).toBeUndefined();
  });

  test("invalidate the actual config file and resolved options", async () => {
    await build();
    const first = await loadCache(root);
    await Bun.write(options.configFile, "export default { title: 'Changed' };");
    await build();
    const second = await loadCache(root);
    expect(second.configHash).not.toBe(first.configHash);
    options.config.noFollowExceptions = ["example.com"];
    await build();
    expect((await loadCache(root)).optionsHash).not.toBe(second.optionsHash);
  });

  test("copy public and template assets from the specified project root", async () => {
    await Bun.write(path.join(root, "public", ".well-known", "example"), "public data");
    await Bun.write(path.join(options.templatesDir, "assets", "LICENSE"), "template asset");
    await build();
    expect(await Bun.file(path.join(options.outputDir, ".well-known", "example")).text()).toBe(
      "public data",
    );
    expect(await Bun.file(path.join(options.outputDir, "assets", "LICENSE")).text()).toBe(
      "template asset",
    );
  });

  test("keep template environments isolated when constructing multiple generators", async () => {
    const first = new SiteGenerator(options);
    const otherTemplates = path.join(root, "other-templates");
    await Bun.write(path.join(otherTemplates, "index.njk"), "Wrong site");
    new SiteGenerator({ ...options, templatesDir: otherTemplates });
    await first.initialize();
    await first.generate();
    expect(await Bun.file(path.join(options.outputDir, "index.html")).text()).toBe("New;Old;");
  });
});
