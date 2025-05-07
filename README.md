# Bunki

[![GitHub license](https://img.shields.io/github/license/kahwee/bunki)](https://github.com/kahwee/bunki/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/kahwee/bunki)](https://github.com/kahwee/bunki/issues)

Bunki is an opinionated static site generator built with Bun. It's designed for creating blogs and simple websites with sensible defaults and minimal configuration.

## Features

- Markdown content with frontmatter
- Syntax highlighting for code blocks
- Tag-based organization
- Year-based archives
- Pagination for post listings
- RSS feed generation
- Sitemap generation
- Local development server
- Simple CLI interface
- Cloud image uploading (Cloudflare R2, S3)

## Installation

> **IMPORTANT**: Bunki requires Bun v1.2.12 or later as its runtime. It is not compatible with Node.js.

### Prerequisites

```bash
# Install Bun if you don't have it
curl -fsSL https://bun.sh/install | bash

# Verify Bun version (should be 1.2.12 or later)
bun --version
```

### Installation Options

```bash
# Install globally
bun install -g bunki

# Or install locally in your project
bun install bunki

# Or from GitHub
git clone git@github.com:kahwee/bunki.git
cd bunki
bun install
bun run build
bun link
```

## Quick Start

### Initialize a New Site

```bash
# Create a new site with default templates and configuration
bunki init
```

### Add Content

Create markdown files in the `content` directory with frontmatter:

```markdown
---
title: Your Post Title
date: 2025-01-01T09:00:00-07:00
tags: [tag1, tag2]
---

Your post content goes here...
```

Or use the CLI to create a new post:

```bash
bunki new "Your Post Title" --tags "tag1, tag2"
```

### Generate Your Site

```bash
# Generate the static site
bunki generate
```

### Preview Your Site

```bash
# Start a local development server
bunki serve
```

## Configuration

The `bunki.config.ts` file contains the configuration for your site:

```typescript
import { SiteConfig } from "bunki";
import { config } from "dotenv";

// Load environment variables from .env file
config();

export default function (): SiteConfig {
  return {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "blog",
    // S3 upload configuration
    s3: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      bucket: process.env.R2_BUCKET || "",
      endpoint: process.env.R2_ENDPOINT,
      region: process.env.R2_REGION || "auto",
      publicUrl: process.env.R2_PUBLIC_URL || "",
    },
  };
}
```

## Image Upload Configuration

Bunki uses Bun's native S3 API for efficient image uploads to S3-compatible services like Cloudflare R2.

Configure image uploading by setting environment variables:

```
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket
R2_PUBLIC_URL=https://your-public-url.com
```

For domain-specific custom domains:

```
R2_CUSTOM_DOMAIN_EXAMPLE_COM=cdn.example.com
```

### Image Upload Commands

```bash
# Upload all images
bunki images:push

# Specify a different images directory
bunki images:push --images path/to/images

# Output URL mapping to a JSON file
bunki images:push --output-json image-urls.json
```

The image uploader supports JPG, PNG, GIF, WebP, and SVG formats.

## Directory Structure

```
.
├── bunki.config.ts     # Configuration file
├── content/            # Markdown content
│   └── YYYY/           # Year-based organization
│       └── post-slug.md
├── templates/          # Nunjucks templates
│   ├── base.njk
│   ├── index.njk
│   ├── post.njk
│   ├── tag.njk
│   ├── tags.njk
│   ├── archive.njk
│   └── styles/
│       └── main.css
├── images/             # Local images directory
└── dist/               # Generated site
```

## CLI Commands

```
Usage: bunki [options] [command]

Commands:
  init [options]        Initialize a new site
  new [options] <title> Create a new blog post
  generate [options]    Generate static site
  serve [options]       Start development server
  images:push [options] Upload images to storage
  help [command]        Display help
```

## Development

```bash
# Run tests
bun test

# Run tests with coverage
bun test:coverage

# Type checking
bun run typecheck
```

## License

MIT
