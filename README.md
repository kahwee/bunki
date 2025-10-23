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

### Overview

The `images:push` command uploads local images to Cloudflare R2, AWS S3, or any S3-compatible storage provider. Images are organized by year in the `images/` directory and uploaded with their full directory structure preserved.

**Supported formats:** JPG, JPEG, PNG, GIF, WebP, SVG

### Directory Structure

Organize images by year and post slug:

```
images/
├── 2023/
│   ├── post-slug-1/
│   │   ├── image-1.jpg
│   │   └── image-2.png
│   └── post-slug-2/
│       └── photo.webp
├── 2024/
│   └── travel-guide/
│       ├── paris-1.jpg
│       ├── london-2.jpg
│       └── tokyo-3.png
└── 2025/
    └── new-post/
        └── screenshot.jpg
```

The directory structure is preserved when uploading to cloud storage.

### Configuration

Add S3/R2 configuration to `bunki.config.ts`:

```typescript
import { SiteConfig } from "bunki";

export default (): SiteConfig => ({
  title: "My Blog",
  // ... other config

  // Image upload configuration
  s3: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    bucket: process.env.S3_BUCKET || "",
    endpoint: process.env.S3_ENDPOINT,           // Optional: for R2, etc.
    region: process.env.S3_REGION || "auto",
    publicUrl: process.env.S3_PUBLIC_URL || "",
  },
});
```

### Environment Variables

Set these in your `.env` file or export them in your shell:

```bash
# Required
export S3_ACCESS_KEY_ID="your-access-key"
export S3_SECRET_ACCESS_KEY="your-secret-key"
export S3_BUCKET="your-bucket-name"
export S3_PUBLIC_URL="https://cdn.example.com"

# Optional (for Cloudflare R2 or custom endpoints)
export S3_ENDPOINT="https://r2.cloudflarestorage.com"
export S3_REGION="auto"

# Optional (custom domain per bucket)
export S3_CUSTOM_DOMAIN_YOUR_BUCKET="cdn.example.com"
```

### Basic Usage

Upload all images:

```bash
bunki images:push
```

This command:
1. Scans the `images/` directory recursively
2. Uploads all supported image formats
3. Preserves the directory structure (year/slug/filename)
4. Generates public URLs for each image

### Command Options

#### `--images <dir>`
Specify a custom images directory (default: `./images`)

```bash
bunki images:push --images ./assets/images
```

#### `--domain <domain>`
Set a custom domain for bucket identification (optional)

```bash
bunki images:push --domain my-blog
```

#### `--output-json <file>`
Export a JSON mapping of filenames to their public URLs

```bash
bunki images:push --output-json image-urls.json
```

This creates a JSON file with the structure:
```json
{
  "2023/post-slug/image.jpg": "https://cdn.example.com/2023/post-slug/image.jpg",
  "2024/travel/paris.jpg": "https://cdn.example.com/2024/travel/paris.jpg"
}
```

#### `--min-year <year>`
Upload only images from the specified year onwards

```bash
# Upload only 2023 and 2024 images (skip 2021, 2022)
bunki images:push --min-year 2023

# Upload only 2024 and newer images
bunki images:push --min-year 2024

# Upload from 2022 onwards (all images in this example)
bunki images:push --min-year 2022
```

This is useful for:
- Incremental uploads (upload only new images)
- Testing uploads for specific years
- Managing large image collections across multiple uploads

### Complete Examples

#### Cloudflare R2 Setup

1. **Create R2 bucket and API token** in Cloudflare dashboard

2. **Set environment variables:**
```bash
export S3_ACCESS_KEY_ID="your-r2-api-token-id"
export S3_SECRET_ACCESS_KEY="your-r2-api-token-secret"
export S3_BUCKET="my-blog-images"
export S3_ENDPOINT="https://r2.cloudflarestorage.com"
export S3_REGION="auto"
export S3_PUBLIC_URL="https://cdn.example.com"
```

3. **Upload images:**
```bash
bunki images:push --output-json image-urls.json
```

#### AWS S3 Setup

1. **Create S3 bucket and IAM user** in AWS Console

2. **Set environment variables:**
```bash
export S3_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export S3_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export S3_BUCKET="my-blog-bucket"
export S3_REGION="us-east-1"
export S3_PUBLIC_URL="https://my-blog-bucket.s3.amazonaws.com"
```

3. **Upload images:**
```bash
bunki images:push
```

#### Incremental Upload (Year-Based)

If you have thousands of images and want to upload them incrementally:

```bash
# First, upload all 2023 images
bunki images:push --min-year 2023 --max-year 2023

# Next, upload 2024 images
bunki images:push --min-year 2024 --max-year 2024

# Finally, upload 2025 images
bunki images:push --min-year 2025
```

### Using Uploaded Images in Markdown

After uploading, reference images in your Markdown posts:

```markdown
---
title: "Paris Trip"
date: 2024-06-15T10:00:00
tags: [travel, france]
---

# My Trip to Paris

![Eiffel Tower at sunset](https://cdn.example.com/2024/paris-trip/eiffel-tower.jpg)

![Louvre Museum](https://cdn.example.com/2024/paris-trip/louvre.jpg)

## Evening Stroll

The Parisian streets at night are magical.

![Seine River at night](https://cdn.example.com/2024/paris-trip/seine-night.jpg)
```

### Dry Run Mode

Test the upload process without actually uploading:

```bash
# Preview what would be uploaded (no actual upload)
BUNKI_DRY_RUN=true bunki images:push
```

This shows:
- Which images would be uploaded
- The directory structure that would be created
- Generated public URLs

### Troubleshooting

#### "Missing S3 configuration"
Ensure all required environment variables are set. Check `bunki.config.ts` and your `.env` file.

#### "No image files found"
- Verify images exist in `images/` directory
- Check that files have supported extensions (.jpg, .png, .gif, .webp, .svg)
- Ensure the directory structure is correct (e.g., `images/2024/post-slug/image.jpg`)

#### "Unauthorized" or "Access Denied"
- Verify S3 credentials (access key and secret key)
- Check that the IAM user/API token has S3 permissions
- Confirm the bucket name is correct

#### "Invalid bucket name"
- S3 bucket names must be globally unique
- Use only lowercase letters, numbers, and hyphens
- Bucket names must be 3-63 characters long

### Advanced Configuration

#### Custom Domain per Bucket

If you have multiple S3 buckets with different custom domains:

```bash
export S3_CUSTOM_DOMAIN_MY_BUCKET="cdn1.example.com"
export S3_CUSTOM_DOMAIN_BACKUP_BUCKET="cdn2.example.com"
```

The bucket name is converted to uppercase and hyphens to underscores for the environment variable name.

#### Direct CDN URLs

Configure public URLs with custom domains:

```typescript
// bunki.config.ts
s3: {
  // ... other config
  publicUrl: "https://img.example.com",
}
```

Or via environment variable:

```bash
export S3_PUBLIC_URL="https://img.example.com"
```

### Performance Tips

1. **Use year-based filtering** for large image collections:
   ```bash
   bunki images:push --min-year 2024  # Only newest images
   ```

2. **Organize by post slug** for better directory structure:
   ```
   images/2024/post-title/image.jpg
   images/2024/post-title/photo.jpg
   ```

3. **Compress images before uploading** to save storage:
   - Use tools like `imagemin` or built-in OS utilities
   - Aim for 500KB or smaller per image

4. **Use modern formats** (WebP) for better compression:
   - JPG/PNG for screenshots
   - WebP for photos
   - SVG for icons/graphics

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
