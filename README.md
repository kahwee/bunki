# Bunki

[![CI](https://github.com/kahwee/bunki/actions/workflows/ci.yml/badge.svg)](https://github.com/kahwee/bunki/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/kahwee/bunki/badge.svg?branch=main)](https://coveralls.io/github/kahwee/bunki?branch=main)
[![npm version](https://badge.fury.io/js/bunki.svg)](https://badge.fury.io/js/bunki)

Fast static site generator for blogs and documentation built with Bun. Supports Markdown + frontmatter, tags, year-based archives, pagination, RSS feeds, sitemaps, secure HTML sanitization, syntax highlighting, PostCSS pipelines, image uploads (S3/R2), and Nunjucks templating.

## Install

Requires **Bun v1.3.0+** (recommended) or Node.js v18+

```bash
# Install globally with Bun
bun install -g bunki

# Or with npm
npm install -g bunki

# Or in your project
bun install bunki
```

## Quick Start

```bash
bunki init                                    # Create new site
bunki new "My First Post" --tags web,notes    # Add content
bunki generate                                # Build static site
bunki serve --port 3000                       # Preview locally
```

This creates a fully functional site with Markdown content, responsive templates, and all assets in `dist/`.

## Configuration

Create `bunki.config.ts` in your project root:

```typescript
import { SiteConfig } from "bunki";

export default (): SiteConfig => ({
  title: "My Blog",
  description: "My thoughts and ideas",
  baseUrl: "https://example.com",
  domain: "example.com",

  // Optional: PostCSS/Tailwind CSS support
  css: {
    input: "templates/styles/main.css",
    output: "css/style.css",
    postcssConfig: "postcss.config.js",
    enabled: true,
  },

  // Optional: Image upload to Cloudflare R2 or S3
  s3: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET || "",
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION || "auto",
    publicUrl: process.env.R2_PUBLIC_URL || "",
  },
});
```

## Content & Frontmatter

Create Markdown files in `content/YYYY/` (e.g., `content/2025/my-post.md`):

```markdown
---
title: "Post Title"
date: 2025-01-15T09:00:00-07:00
tags: [web, performance]
excerpt: "Optional summary for listings"
---

# Post Title

Your content here with **markdown** support.

![Image alt text](/images/my-image.jpg)

<video controls width="640" height="360">
  <source src="video.mp4" type="video/mp4">
  Your browser does not support HTML5 video.
</video>
```

Optional: Define tag descriptions in `src/tags.toml`:

```toml
performance = "Performance optimization and speed"
web = "Web development and technology"
```

## CSS & Tailwind

To use Tailwind CSS:

```bash
bun add -D tailwindcss @tailwindcss/postcss @tailwindcss/typography
```

Create `postcss.config.js`:

```javascript
module.exports = {
  plugins: [require("@tailwindcss/postcss")],
};
```

Create `templates/styles/main.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

CSS is processed automatically during `bunki generate`.

## Image Management

Upload images to Cloudflare R2 or S3:

```bash
# Set up environment variables first
cat > .env << EOF
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=https://cdn.example.com
EOF

# Upload images
bunki images:push --images ./images --output-json image-map.json
```

Supported formats: JPG, PNG, GIF, WebP, SVG

## CLI Commands

```bash
bunki init [--config FILE]                 # Initialize new site
bunki new <TITLE> [--tags TAG1,TAG2]       # Create new post
bunki generate [--config FILE]             # Build static site
bunki serve [--port 3000]                  # Start dev server
bunki css [--watch]                        # Process CSS
bunki images:push [--domain DOMAIN]        # Upload images to cloud
```

## Output Structure

```
dist/
├── index.html              # Homepage
├── feed.xml                # RSS feed
├── sitemap.xml             # XML sitemap
├── css/style.css           # Processed stylesheet
├── 2025/
│   └── my-post/
│       └── index.html      # Post page
├── tags/
│   └── web/
│       └── index.html      # Tag page
└── page/
    └── 2/index.html        # Paginated content
```

## Features

- **Markdown Processing**: Frontmatter extraction, code highlighting, HTML sanitization
- **Security**: XSS protection, sanitized HTML, link hardening
- **Performance**: Static files, optional gzip, optimized output
- **Templating**: Nunjucks with custom filters and macros
- **Styling**: Built-in PostCSS support for modern CSS frameworks
- **Images**: Direct S3/R2 uploads with URL mapping
- **SEO**: Automatic RSS feeds, sitemaps, meta tags
- **Pagination**: Configurable posts per page
- **Archives**: Year-based and tag-based organization

## Development

```bash
git clone git@github.com:kahwee/bunki.git
cd bunki
bun install

bun run build              # Build distribution
bun test                   # Run test suite
bun test:coverage          # Test coverage report
bun run typecheck          # TypeScript validation
bun run format             # Prettier formatting
```

## Project Structure

```
bunki/
├── src/
│   ├── cli.ts             # CLI interface
│   ├── config.ts          # Configuration management
│   ├── site-generator.ts  # Core generation logic
│   ├── server.ts          # Development server
│   ├── parser.ts          # Markdown parsing
│   ├── types.ts           # TypeScript types
│   └── utils/             # Utility modules
├── test/                  # Test suite (mirrors src/)
├── templates/             # Example templates
├── fixtures/              # Test fixtures
└── dist/                  # Built output
```

## Changelog

### v0.5.3 (Current)

- Modularized CLI commands with dependency injection
- Enhanced test coverage (130+ tests, 539+ assertions)
- Fixed CLI entry point detection (Bun.main compatibility)
- Added comprehensive server tests using Bun.serve()
- Improved CSS processor with fallback support

### v0.3.0

- PostCSS integration with CSS processing command
- Framework-agnostic CSS support (Tailwind, etc.)
- CSS watch mode for development
- Better error handling and recovery

## Contributing

Contributions welcome! Areas for improvement:

- Bug fixes and error handling
- Documentation and examples
- Test coverage expansion
- Performance optimizations
- New features and plugins

## License

MIT © [KahWee Teng](https://github.com/kahwee)

Built with [Bun](https://bun.sh)
