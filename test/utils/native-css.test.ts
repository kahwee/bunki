import { afterEach, beforeEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { generateStylesheet } from "../../src/generators/assets";
import { processCSS } from "../../src/utils/css-processor";

let root: string;
beforeEach(async () => {
  const parent = path.join(import.meta.dir, "css-test");
  await fs.mkdir(parent, { recursive: true });
  root = await fs.mkdtemp(path.join(parent, "native-"));
  await Bun.write(path.join(root, "main.css"), "a { color: red; }");
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const plugin = `export default { plugins: [{ postcssPlugin: 'test-color', Declaration(decl) { if (decl.prop === 'color') decl.value = 'blue'; } }] };`;
const options = () => ({
  css: { input: "main.css", output: "nested/style.css", enabled: true },
  projectRoot: root,
  outputDir: path.join(root, "out"),
});

test("native CSS bundles imports and inlines referenced assets at the configured output path", async () => {
  await Bun.write(path.join(root, "colors.css"), ".imported { color: blue; }");
  await Bun.write(path.join(root, "font.woff2"), new Uint8Array(8192));
  await Bun.write(
    path.join(root, "main.css"),
    '@import "./colors.css"; a { background: url("./font.woff2"); }',
  );
  const result = await processCSS({ ...options(), enableHashing: true });
  const css = await Bun.file(result.outputPath).text();
  expect(result.hash).toBeDefined();
  expect(css).toContain(".imported");
  expect(css).not.toContain("@import");
  const asset = css.match(/data:font\/woff2;base64,([^"')]+)/)?.[1];
  expect(asset).toBeDefined();
  expect(Buffer.from(asset!, "base64")).toEqual(Buffer.alloc(8192));
});

test("auto mode preserves project PostCSS plugins", async () => {
  await Bun.write(path.join(root, "postcss.config.js"), plugin);
  const result = await processCSS(options());
  expect(await Bun.file(result.outputPath).text()).toContain("blue");
});

test("auto mode detects CommonJS PostCSS config", async () => {
  await Bun.write(
    path.join(root, "postcss.config.cjs"),
    plugin.replace("export default", "module.exports ="),
  );
  const result = await processCSS(options());
  expect(await Bun.file(result.outputPath).text()).toContain("blue");
});

test("explicit Bun selection bypasses PostCSS plugins", async () => {
  await Bun.write(path.join(root, "postcss.config.js"), 'throw new Error("must not load")');
  const opts = options();
  const result = await processCSS({ ...opts, css: { ...opts.css, processor: "bun" } });
  expect(await Bun.file(result.outputPath).text()).toContain("red");
});

test("native CSS reports missing imports for the site generator fallback", async () => {
  await Bun.write(path.join(root, "main.css"), '@import "./missing.css";');
  await expect(processCSS(options())).rejects.toThrow();
});

test("site generation preserves raw CSS when native bundling fails", async () => {
  const css = '@import "./missing.css"; a { color: red; }';
  await Bun.write(path.join(root, "main.css"), css);
  const opts = options();
  await generateStylesheet(
    {
      title: "CSS fallback",
      description: "Test",
      baseUrl: "https://example.com",
      domain: "example.com",
      css: opts.css,
    },
    opts.outputDir,
    root,
  );
  expect(await Bun.file(path.join(opts.outputDir, opts.css.output)).text()).toBe(css);
});

test("site generation fails when a configured PostCSS plugin throws", async () => {
  await Bun.write(
    path.join(root, "postcss.config.js"),
    `export default { plugins: [{ postcssPlugin: 'broken', Once() { throw new Error('plugin failed'); } }] };`,
  );
  const opts = options();
  await expect(
    generateStylesheet(
      {
        title: "CSS",
        description: "Test",
        baseUrl: "https://example.com",
        domain: "example.com",
        css: opts.css,
      },
      opts.outputDir,
      root,
    ),
  ).rejects.toThrow("PostCSS processing failed");
});
