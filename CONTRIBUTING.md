# Contributing

Use the Bun version declared in [package.json](package.json) or newer. Install dependencies with `bun install --frozen-lockfile` when reproducing a checkout. Use `bun install` when intentionally changing dependencies, and commit `bun.lock` with the manifest.

## Find the implementation

| Area | Entry points |
| --- | --- |
| CLI and config | `src/cli.ts`, `src/cli/commands/`, `src/config.ts` |
| Content parsing and validation | `src/parser.ts`, `src/utils/markdown-utils.ts`, `src/utils/markdown/` |
| Derived site data | `src/site-model.ts` |
| Rendering and output | `src/site-generator.ts`, `src/generators/`, `src/utils/template-engine.ts` |
| Cache and change detection | `src/utils/build-cache.ts`, `src/utils/change-detector.ts` |
| CSS and uploads | `src/utils/css-processor.ts`, `src/utils/image-uploader.ts`, `src/utils/s3-uploader.ts` |

The public package exports are in `src/index.ts`. Builds emit `dist/index.js`, TypeScript declarations, `dist/cli.js`, and template fragments. Edit the source rather than generated files in `dist/`.

## Check a change

```bash
bun test test/parser.test.ts  # Example of a focused test
bun run typecheck
bun run lint
bun run build
```

Run `bun test` for cross-cutting changes. `bun run test:coverage` produces LCOV output. `bun run format` writes formatting changes; `bun run lint` checks without editing. CI also verifies package artifacts and builds a starter site.

Use temporary directories for tests that create files, and remove them in teardown. Sample content in `fixtures/` exercises rendering; it is not a source of measured performance claims. Keep regression tests focused on observable behavior, including full/incremental equivalence when changing the cache.

## Measure performance

```bash
bun run benchmark -- 1000
```

The benchmark creates a temporary site and measures three runs each of a cold cache, an unchanged warm cache, and a single edited post. “Cold” means an empty Bunki cache, not an empty operating-system disk cache. Times include initialization and generation but exclude fixture setup. CSS is disabled and templates are minimal.

Compare the same post count and Bun version on the same machine, with other builds stopped. Report medians and the workload alongside any speedup. Use a representative site separately to evaluate PostCSS, real templates, asset volumes, or uploads.

## Update documentation

Keep the [README](README.md) focused on getting started and common workflows. Put detailed behavior and limitations in the [reference](docs/reference.md). Update CLI help when a flag's meaning changes, and update examples in `src/cli/commands/init.ts` when the generated starter content changes.

[AGENTS.md](AGENTS.md) contains the short agent guide; `CLAUDE.md` is a symlink to it.
