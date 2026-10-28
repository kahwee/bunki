# Bunki

Bunki is a TypeScript static site generator built with Bun. Use Bun 1.4.4+ for dependency installation, development, builds, and tests.

## Working here

Use your judgment on implementation and verification. Follow nearby code and the repository's tooling; prefer Bun APIs where practical. Keep changes focused and update documentation when user-facing behavior changes.

`package.json` defines the commands. Run `bun run check` for the full local gate: formatting, type checking, and tests run in parallel before package artifacts are built. Use `bun test <path>` for focused tests and `bun run test:coverage` for coverage. `build:artifacts` does not validate source; run it only after successful source checks. Report any failures or checks you couldn't run.

## Where to look

- `src/cli.ts` registers commands; `src/cli/commands/` implements them.
- `src/config.ts` owns configuration; `src/parser.ts` and `src/utils/markdown/` handle content parsing.
- `src/generators/` produces site output; `templates/` contains Nunjucks templates and styles.
- `test/` and `fixtures/` cover behavior; `README.md` covers quick start, `docs/reference.md` explains behavior, and `CONTRIBUTING.md` covers development.

Read the relevant implementation before changing behavior or documenting it.

## Behaviors to preserve

- Sanitize rendered user content and keep relative Markdown links working in generated sites.
- Use timezone-aware ISO dates and hyphenated tag slugs.
- Keep CSS output usable when optional PostCSS processing is unavailable or fails; use content-based cache busting.
- Keep media uploads separate from local site generation.
