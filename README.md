# Bunki

[![CI](https://github.com/kahwee/bunki/actions/workflows/ci.yml/badge.svg)](https://github.com/kahwee/bunki/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/kahwee/bunki/badge.svg?branch=main)](https://coveralls.io/github/kahwee/bunki?branch=main)
[![npm version](https://badge.fury.io/js/bunki.svg)](https://badge.fury.io/js/bunki)

Bunki turns Markdown into a blog, a collection of notes, or a documentation site. Built with [Bun](https://bun.sh), it pairs editable Nunjucks templates with static HTML you can host wherever you like.

![Bunki — Your words, on your own site.](docs/assets/bunki-banner.svg)

[Get started](#quick-start) · [Read the reference](docs/reference.md) · [Contribute](CONTRIBUTING.md)

## Quick start

Requires Bun 1.4.3 or newer. Run `bun upgrade` to update an existing Bun installation.

```bash
mkdir my-blog
cd my-blog
bun init -y
bun add bunki

bunx bunki init
bunx bunki new "My First Post" --tags web,notes
bunx bunki generate
bunx bunki serve --port 3000
```

Open <http://localhost:3000>. Edit `bunki.config.ts` for your site details, `content/` for posts, and `templates/` for layout. Files in `public/` are copied into the generated site in `dist/`, which you can deploy to a static host.

```text
my-blog/
├── bunki.config.ts   Site settings
├── content/          Your Markdown posts
├── templates/        Layouts and styles
├── public/           Files to copy as-is
└── dist/             Generated site
```

For a global CLI, use `bun add -g bunki` and run `bunki` in place of `bunx bunki`.

## Configuration

```typescript
import { defineConfig } from "bunki";

export default defineConfig({
  title: "Field Notes",
  description: "Things I build, places I go, and what I learn.",
  baseUrl: "https://example.com",
  domain: "example.com",
  authorName: "Your Name",
  authorEmail: "you@example.com",
  rssLanguage: "en-US",
});
```

See [configuration types](src/types.ts) for available options and [configuration defaults](src/config.ts) for loading behavior.

The [reference](docs/reference.md) covers path overrides, template data, validation, and cache limitations.

## Write a post

Posts live under `content/`. Use either `content/2026/my-post.md` or `content/2026/my-post/README.md`, but avoid both for the same slug.

```markdown
---
title: "A place for small discoveries"
date: 2026-09-11T09:00:00-07:00
tags: [web-development, notes]
excerpt: "Notes worth keeping, one post at a time."
---

Today I started keeping a few **field notes**.

![A photo](/images/photo.jpg)
```

Saved as `my-post.md`, the example generates `/2026/my-post/`. The URL year comes from the frontmatter date in Pacific time, not the directory name. Use timezone-aware dates and hyphenated tag slugs such as `web-development`.

Relative Markdown links such as `../2025/earlier-post.md` become site links such as `/2025/earlier-post/`. Optional tag descriptions go in `src/tags.toml`:

```toml
web-development = "Notes on building for the web"
```

For business or location metadata, add `business` to frontmatter:

```yaml
business:
  - type: Restaurant
    name: "Example Cafe"
    address: "123 Main St, San Francisco, CA"
    lat: 37.7749
    lng: -122.4194
```

Use `business`, `lat`, and `lng`; the older `location`, `latitude`, and `longitude` fields fail validation. Check content with `bunx bunki validate` and media with `bunx bunki validate:media`.

## Templates and uploads

Edit Nunjucks templates and CSS for your layout. The [reference](docs/reference.md)
covers template data, PostCSS, S3-compatible uploads, and their configuration.
Uploads run separately from site generation.

## Commands

Run `bunx bunki <command> --help` for all options.

| Command | Purpose |
| --- | --- |
| `init` | Create configuration, templates, and sample content |
| `new <title> --tags web,notes` | Create a Markdown post |
| `generate` | Build the site in `dist/` |
| `generate --incremental` | Reuse cached posts and unchanged CSS |
| `serve --port 3000` | Preview generated files locally |
| `css --watch` | Process CSS and watch for changes |
| `validate` | Check Markdown and frontmatter |
| `validate:media` | Check media files |
| `images:push` | Upload media to S3-compatible storage |

`generate` accepts `--config`, `--content`, `--output`, and `--templates` to override paths.

Incremental builds store parsed posts and file checks in `.bunki-cache.json`; HTML pages are still regenerated. Full and incremental builds use the same validation and date ordering. Config changes invalidate cached posts; content changes also rebuild CSS. Add the cache to `.gitignore`. Delete that cache file to reset it, or omit `--incremental` for a full build.

## Development

Bug reports, documentation improvements, and focused contributions are welcome. Start with the [contribution guide](CONTRIBUTING.md) or [open an issue](https://github.com/kahwee/bunki/issues).

```bash
git clone https://github.com/kahwee/bunki.git
cd bunki
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run lint
bun run build
bun run benchmark -- 1000  # Measure cold, cached, and single-post-edit builds
```

Source lives in `src/`, tests in `test/`, and test data in `fixtures/`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [package.json](package.json) for additional scripts.

GitHub Actions runs typechecking, linting, coverage tests, a build, and a site-generation smoke test. Compatibility checks cover the minimum supported Bun version and the latest release.

The benchmark creates and removes a temporary site, runs each scenario three times, and reports median wall-clock times. It uses synthetic Markdown and minimal templates with CSS disabled, so it measures parsing, caching, and site generation rather than PostCSS or network uploads.

## License

[MIT](LICENSE) © [KahWee Teng](https://github.com/kahwee)

## CI maintenance

[GitHub Actions maintenance](.github/ACTIONS.md) covers workflows, parallel checks, action versions, and weekly updates.
