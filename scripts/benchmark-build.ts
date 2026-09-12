import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SiteGenerator } from "../src/site-generator";
import type { GeneratorOptions } from "../src/types";

const count = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(count) || count < 1) throw new Error("Post count must be a positive integer");
const root = await mkdtemp(path.join(tmpdir(), "bunki-benchmark-"));
const log = console.log;
const samples: Record<string, number[]> = { cold: [], warm: [], edited: [] };
const options: GeneratorOptions = {
  rootDir: root,
  contentDir: path.join(root, "content"),
  templatesDir: path.join(root, "templates"),
  outputDir: path.join(root, "dist"),
  config: {
    title: "Benchmark",
    description: "Synthetic build benchmark",
    domain: "example.com",
    baseUrl: "https://example.com",
    css: { enabled: false, input: "style.css", output: "style.css" },
  },
};

try {
  await Bun.write(path.join(root, "bunki.config.ts"), "export default {};");
  for (const name of ["index", "post", "tags", "tag", "archive", "404", "map", "privacy"]) {
    await Bun.write(
      path.join(options.templatesDir, `${name}.njk`),
      '<!doctype html><title>{{ site.title }}</title>{{ post.html | safe }}{% for p in posts %}<a href="{{ p.url }}">{{ p.title }}</a>{% endfor %}',
    );
  }
  for (let i = 0; i < count; i++) {
    await Bun.write(
      path.join(options.contentDir, `post-${i}.md`),
      `---\ntitle: Post ${i}\ndate: 2026-01-01T12:00:00-08:00\ntags: [tag-${i % 20}, benchmark]\n---\n\n${"A paragraph with **Markdown**, [a link](https://example.com), and useful content.\n\n".repeat(20)}`,
    );
  }
  console.log = () => {};
  for (let run = 0; run < 3; run++) {
    await rm(path.join(root, ".bunki-cache.json"), { force: true });
    for (const mode of ["cold", "warm", "edited"] as const) {
      if (mode === "edited") {
        const postPath = path.join(options.contentDir, "post-0.md");
        await Bun.write(postPath, `${await Bun.file(postPath).text()}\nEdit ${run}.\n`);
      }
      const start = performance.now();
      const generator = new SiteGenerator(options);
      generator.enableIncrementalMode();
      await generator.initialize();
      await generator.generate();
      samples[mode].push(performance.now() - start);
    }
  }
} finally {
  console.log = log;
  await rm(root, { recursive: true, force: true });
}
log(
  JSON.stringify(
    {
      posts: count,
      milliseconds: Object.fromEntries(
        Object.entries(samples).map(([mode, values]) => [
          mode,
          {
            median: Math.round([...values].sort((a, b) => a - b)[1]),
            samples: values.map(Math.round),
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
