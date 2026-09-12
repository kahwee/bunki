---
title: "Performance Optimization in Bunki"
date: 2025-02-10T10:30:00-07:00
tags: [performance, web-development, bun]
excerpt: How Bunki reduces repeated parsing and filesystem work, and how to measure build performance.
---

# Performance Optimization in Bunki

This sample post demonstrates Markdown rendering while describing Bunki's build pipeline. It is not a comparison benchmark against other generators.

## File handling

Bunki uses Bun's file APIs to read content and write generated output:

```typescript
const content = await Bun.file(filePath).text();
await Bun.write(outputPath, renderedContent);
```

Passing a `BunFile` directly to `Bun.write` also avoids materializing a JavaScript string when copying an asset.

## Bounded concurrency

Parsing and file operations use bounded concurrency. This overlaps I/O without starting an unlimited number of operations. Async concurrency does not by itself run JavaScript parsing on multiple CPU cores.

## Reusing work

Incremental builds cache parsed posts and check file metadata before parsing again. Full and incremental builds share validation and ordering. Nunjucks caches compiled templates in its environment, and each site generator retains its own environment.

HTML pages are still rendered on every build. PostCSS and large asset collections can therefore dominate a real site's build time even when Markdown parsing is cached.

## Measuring a change

From a Bunki source checkout, run:

```bash
bun run benchmark -- 1000
```

The benchmark reports three samples and a median for cold-cache, warm-cache, and single-post-edit builds. It uses a synthetic site with minimal templates and CSS disabled. Compare the same workload on the same machine, then measure your own site before drawing conclusions.

See the [contribution guide](https://github.com/kahwee/bunki/blob/main/CONTRIBUTING.md) for the benchmark workflow.
