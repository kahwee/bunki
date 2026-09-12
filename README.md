# Bunki

[![CI](https://github.com/kahwee/bunki/actions/workflows/ci.yml/badge.svg)](https://github.com/kahwee/bunki/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/kahwee/bunki/badge.svg?branch=main)](https://coveralls.io/github/kahwee/bunki?branch=main)
[![npm version](https://badge.fury.io/js/bunki.svg)](https://badge.fury.io/js/bunki)

A static site generator for blogs and documentation, built with [Bun](https://bun.sh). Write Markdown, customize Nunjucks templates, and publish static files. Bunki includes tags, yearly archives, pagination, RSS, sitemaps, syntax highlighting, HTML sanitization, and structured data. PostCSS and S3-compatible media uploads are optional.

## Quick start

Requires Bun 1.4.2 or newer. Run `bun upgrade` to update an existing Bun installation.

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

For a global CLI, use `bun add -g bunki` and run `bunki` in place of `bunx bunki`.

## Configuration

```typescript
import { defineConfig } from "bunki";

export default defineConfig({
  title: "My Blog",
  description: "My thoughts and ideas",
  baseUrl: "https://example.com",
  domain: "example.com",
  authorName: "Your Name",
  authorEmail: "you@example.com",
  rssLanguage: "en-US",
});
```

See [configuration types](src/types.ts) for available options and [configuration defaults](src/config.ts) for loading behavior.

The [reference](docs/reference.md) covers path overrides, template data, validation, and cache limitations.

## Content

Posts live under `content/`. Use either `content/2026/my-post.md` or `content/2026/my-post/README.md`, but avoid both for the same slug.

```markdown
---
title: "My First Post"
date: 2026-09-11T09:00:00-07:00
tags: [web-development, notes]
excerpt: "An optional summary for listings."
---

Your content here with **Markdown** support.

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

## Templates and styles

Bunki uses Nunjucks templates in `templates/`. The defaults include social metadata and JSON-LD. Site and author configuration, post excerpts, tags, and the first content image supply metadata.

Built-in fragments can be imported into your templates. A local file with the same name overrides the built-in fragment.

| Fragment | Macros |
| --- | --- |
| `og-image.njk` | `og_image(post, site)`, `twitter_image(post, site)` |
| `json-ld.njk` | `blog_posting_schema(post, site)`, `local_business_schema(post, site)` |
| `share-buttons.njk` | `share_buttons(post, site)` |
| `pagination.njk` | `pagination_nav(pagination)` |

```nunjucks
{% from "pagination.njk" import pagination_nav %}
{{ pagination_nav(pagination) }}
```

The share and pagination fragments use Tailwind utility classes. See the [example templates](templates) for layout.

To enable CSS processing, add this to `defineConfig({...})`:

```typescript
css: {
  input: "templates/styles/main.css",
  output: "css/style.css",
  postcssConfig: "postcss.config.js",
  enabled: true,
},
```

CSS runs during generation, with a fallback if PostCSS is unavailable or fails. For a Tailwind setup, see this repo's [PostCSS config](postcss.config.js) and [stylesheet](templates/styles/main.css).

## Media uploads

`images:push` uploads JPG, JPEG, PNG, GIF, WebP, SVG, MP4, WebM, and MOV files to S3-compatible storage. Uploads are separate from site generation.

Add this to `defineConfig({...})`, with credentials in your environment or an uncommitted `.env` file:

```typescript
s3: {
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  bucket: process.env.S3_BUCKET || "",
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  publicUrl: process.env.S3_PUBLIC_URL || "",
},
```

By default, media comes from `assets/`, preserving paths such as `2026/my-post/photo.jpg`.

```bash
# Preview without uploading
BUNKI_DRY_RUN=true bunx bunki images:push

# Upload one year and save the public URL mapping
bunx bunki images:push --min-year 2026 --max-year 2026 --output-json media-urls.json

# Upload from content/2026/_assets/ instead
bunx bunki images:push --content-assets
```

With `--content-assets`, `content/2026/_assets/photo.jpg` uses the storage key `2026/photo.jpg`. Set `contentAssets.assetsDir` or pass `--content-assets-dir` for another folder name; `contentAssets.s3` can specify a separate bucket. Use `--images` to override the source directory and `--domain` for bucket identification.

Reference uploaded media by its public URL:

```html
<video controls>
  <source src="https://cdn.example.com/2026/my-post/video.mp4" type="video/mp4">
</video>
```

For upload failures, check the configured source directory, supported file extensions, bucket, endpoint, and credential permissions.

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

```bash
git clone https://github.com/kahwee/bunki.git
cd bunki
bun install
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
