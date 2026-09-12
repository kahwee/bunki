# Bunki

Bunki is a TypeScript static site generator built with Bun. Use Bun 1.3.14+ for dependency installation, development, builds, and tests.

## Working here

Use your judgment on implementation and verification. Follow nearby code and the repository's tooling; prefer Bun APIs where practical. Keep changes focused and update documentation when user-facing behavior changes.

`package.json` defines the commands. The main checks are `bun test`, `bun run typecheck`, `bun run lint`, and `bun run build`. Run the checks relevant to the change and report any failures or checks you couldn't run.

## Where to look

- `src/cli.ts` registers commands; `src/cli/commands/` implements them.
- `src/config.ts` owns configuration; `src/parser.ts` and `src/utils/markdown/` handle content parsing.
- `src/generators/` produces site output; `templates/` contains Nunjucks templates and styles.
- `test/` and `fixtures/` cover behavior; `README.md` documents usage.

Read the relevant implementation before changing behavior or documenting it.

## Behaviors to preserve

- Sanitize rendered user content and keep relative Markdown links working in generated sites.
- Use timezone-aware ISO dates and hyphenated tag slugs.
- Keep CSS output usable when optional PostCSS processing is unavailable or fails; use content-based cache busting.
- Keep media uploads separate from local site generation.
