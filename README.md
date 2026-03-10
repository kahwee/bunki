# Bunki

[![CI](https://github.com/kahwee/bunki/actions/workflows/ci.yml/badge.svg)](https://github.com/kahwee/bunki/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/kahwee/bunki/badge.svg?branch=main)](https://coveralls.io/github/kahwee/bunki?branch=main)
[![npm version](https://badge.fury.io/js/bunki.svg)](https://badge.fury.io/js/bunki)

Fast static site generator for blogs and documentation built with Bun. Supports Markdown + frontmatter, tags, year-based archives, pagination, RSS feeds, sitemaps, JSON-LD structured data for SEO, secure HTML sanitization, syntax highlighting, PostCSS pipelines, media uploads (images & videos to S3/R2), incremental uploads with year filtering, and Nunjucks templating.

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

Create Markdown files in `content/YYYY/` using either pattern:

**Option 1: Single file** (traditional)

```
content/2025/my-post.md
```

**Option 2: Directory with README** (Obsidian-friendly)

```
content/2025/my-post/README.md
content/2025/my-post/image.jpg
```

Both patterns generate the same output: `dist/2025/my-post/index.html`

> [!WARNING]
> You cannot have both patterns for the same slug. Bunki will throw a validation error if both `content/2025/my-post.md` AND `content/2025/my-post/README.md` exist.

Example frontmatter:

```markdown
---
title: "Post Title"
date: 2025-01-15T09:00:00-07:00
tags: [web-development, performance-optimization]
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

### Tag Format

> [!IMPORTANT]
> Tags must use hyphens instead of spaces: `web-development` NOT `"web development"`

Tags with spaces will fail validation. Use hyphenated slugs:

- ✅ `tags: [new-york-city, travel, family-friendly]`
- ❌ `tags: ["new york city", "travel", "family friendly"]`

Optional: Define tag descriptions in `src/tags.toml`:

```toml
performance-optimization = "Performance optimization and speed"
web-development = "Web development and technology"
new-york-city = "New York City travel guides"
```

### Internal Links (Relative Markdown Links)

Bunki automatically converts relative markdown links to absolute URLs during build time. This lets you write cross-references using familiar file paths:

**In your markdown:**

```markdown
Check out [my earlier post](../2023/introduction.md) for context.

See also [related article](../../2020/old-post.md).
```

**Generated HTML:**

```html
<a href="/2023/introduction/">my earlier post</a>
<a href="/2020/old-post/">related article</a>
```

This feature works with:

- `../YEAR/slug.md` - Single level up
- `../../YEAR/slug.md` - Multiple levels up
- Any number of `../` sequences

The links are automatically converted to absolute URLs (`/YEAR/slug/`) that match your site's URL structure.

### Business Location Data

Add structured business/location data with automatic validation:

```markdown
---
title: "Restaurant Review"
date: 2025-01-15T09:00:00-07:00
tags: [food, review]
business:
  - type: Restaurant
    name: "Blue Bottle Coffee"
    address: "123 Main St, San Francisco, CA 94102"
    lat: 37.7749
    lng: -122.4194
---
```

**Required fields:** `type`, `name`, `lat`, `lng`
**Optional fields:** `address`, `cuisine`, `priceRange`, `telephone`, `url`, `openingHours`

The validator enforces:

- Use `business:` (not deprecated `location:`)
- Use `lat:`/`lng:` (not deprecated `latitude:`/`longitude:`)
- All required fields must be present

Validation runs automatically during `bunki generate` and `bunki validate`.

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

## JSON-LD Structured Data for SEO

Bunki automatically generates [JSON-LD](https://json-ld.org/) structured data markup for enhanced SEO and search engine visibility. JSON-LD (JavaScript Object Notation for Linked Data) is Google's recommended format for structured data.

### What is JSON-LD?

JSON-LD helps search engines better understand your content by providing explicit, structured information about your pages. This can lead to:

- **Rich snippets** in search results (article previews, star ratings, etc.)
- **Better content indexing** and understanding by search engines
- **Improved click-through rates** from search results
- **Knowledge graph integration** with Google, Bing, and other search engines

### Automatic Schema Generation

Bunki automatically generates appropriate schemas for different page types:

#### Blog Posts (BlogPosting Schema)

Every blog post includes comprehensive `BlogPosting` schema with:

- Headline and description
- Publication and modification dates
- Author information
- Publisher details
- Article keywords (from tags)
- Word count
- Featured image (automatically extracted)
- Language information

Example output in your HTML:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Getting Started with Bun",
    "description": "Learn how to get started with Bun, the fast JavaScript runtime.",
    "url": "https://example.com/2025/getting-started-with-bun/",
    "datePublished": "2025-01-15T10:30:00.000Z",
    "dateModified": "2025-01-15T10:30:00.000Z",
    "author": {
      "@type": "Person",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "My Blog",
      "url": "https://example.com"
    },
    "keywords": "bun, javascript, performance",
    "image": "https://example.com/images/bun-logo.png"
  }
</script>
```

#### Homepage (WebSite & Organization Schemas)

The homepage includes dual schemas:

1. **WebSite Schema**: Defines the website entity
2. **Organization Schema**: Defines the publisher/organization

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "My Blog",
    "url": "https://example.com",
    "description": "My thoughts and ideas",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://example.com/search?q={search_term_string}"
      }
    }
  }
</script>
```

#### Breadcrumbs (BreadcrumbList Schema)

All pages include breadcrumb navigation for better site hierarchy understanding:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://example.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Getting Started with Bun",
        "item": "https://example.com/2025/getting-started-with-bun/"
      }
    ]
  }
</script>
```

### Configuration for SEO

Enhance your JSON-LD output by providing complete author and site information in `bunki.config.ts`:

```typescript
import { SiteConfig } from "bunki";

export default (): SiteConfig => ({
  title: "My Blog",
  description: "My thoughts and ideas on web development",
  baseUrl: "https://example.com",
  domain: "example.com",

  // Author information (used in BlogPosting schema)
  authorName: "John Doe",
  authorEmail: "john@example.com",

  // RSS/SEO configuration
  rssLanguage: "en-US", // Language code for content
  copyright: "Copyright © 2025 My Blog",

  // ... other config
});
```

### Testing Your JSON-LD

You can validate your structured data using these tools:

1. **[Google Rich Results Test](https://search.google.com/test/rich-results)** - Test how Google sees your structured data
2. **[Schema.org Validator](https://validator.schema.org/)** - Validate JSON-LD syntax
3. **[Structured Data Linter](http://linter.structured-data.org/)** - Check for errors and warnings

### Supported Schema Types

Bunki currently supports these Schema.org types:

- **BlogPosting** - Individual blog posts and articles
- **WebSite** - Homepage and site-wide metadata
- **Organization** - Publisher/organization information
- **Person** - Author information
- **BreadcrumbList** - Navigation breadcrumbs

### How It Works

JSON-LD generation is completely automatic:

1. **Post Creation**: When you write a post with frontmatter, Bunki extracts metadata
2. **Site Generation**: During `bunki generate`, appropriate schemas are created
3. **Template Injection**: JSON-LD scripts are automatically injected into `<head>`
4. **Image Extraction**: The first image in your post content is automatically used as the featured image

No manual configuration needed - just run `bunki generate` and your site will have complete structured data!

### Best Practices

To maximize SEO benefits:

1. **Use descriptive titles** - Your post title becomes the schema headline
2. **Write good excerpts** - These become schema descriptions
3. **Include images** - First image in content is used as featured image
4. **Tag your posts** - Tags become schema keywords
5. **Set author info** - Complete `authorName` and `authorEmail` in config
6. **Use ISO 8601 dates** - Format: `2025-01-15T10:30:00-07:00`

### Further Reading

- [Schema.org Documentation](https://schema.org/)
- [Google Search Central - Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [JSON-LD Official Spec](https://json-ld.org/)

## Template Fragments

Bunki ships reusable Nunjucks macros called **fragments**. They're registered as a second template search path alongside your site's `templates/` directory, so you can import them from any template without any configuration.

### Available fragments

| File | Macros | Purpose |
|------|--------|---------|
| `og-image.njk` | `og_image(post, site)`, `twitter_image(post, site)` | Open Graph and Twitter Card image meta tags |
| `json-ld.njk` | `blog_posting_schema(post, site)`, `local_business_schema(post, site)` | Schema.org structured data scripts |
| `share-buttons.njk` | `share_buttons(post, site)` | X / Facebook / LinkedIn / Email share button row (Tailwind) |
| `pagination.njk` | `pagination_nav(pagination)` | Previous / Next pagination nav (Tailwind) |

### Using fragments

Import macros at the top of any template with `{% from %}`:

```nunjucks
{# post.njk #}
{% from "og-image.njk" import og_image, twitter_image %}
{% from "json-ld.njk" import blog_posting_schema %}

{% block og_image %}{{ og_image(post, site) }}{% endblock %}
{% block twitter_image %}{{ twitter_image(post, site) }}{% endblock %}

{% block head %}
  {{ blog_posting_schema(post, site) }}
{% endblock %}
```

```nunjucks
{# index.njk, tag.njk, archive.njk #}
{% from "pagination.njk" import pagination_nav %}

{{ pagination_nav(pagination) }}
```

The default templates generated by `bunki init` use `og-image.njk` and `json-ld.njk` automatically. The `share-buttons.njk` and `pagination.njk` fragments use Tailwind CSS utility classes and are intended for sites that include Tailwind in their build.

### Writing your own fragments

Fragments are standard Nunjucks macro files. You can place your own in your site's `templates/` directory and import them the same way — site templates take priority over built-in fragments if names collide.

```nunjucks
{# templates/my-macros.njk #}
{% macro breadcrumbs(post, site) %}
  <nav aria-label="Breadcrumb">
    <a href="/">Home</a> /
    <span>{{ post.title }}</span>
  </nav>
{% endmacro %}
```

```nunjucks
{# templates/post.njk #}
{% from "my-macros.njk" import breadcrumbs %}
{{ breadcrumbs(post, site) }}
```

### Template variables reference

| Variable | Available in | Description |
|----------|-------------|-------------|
| `site` | All templates | Site config: `title`, `description`, `baseUrl`, `author` |
| `post` | `post.njk` | Post data: `title`, `excerpt`, `html`, `url`, `date`, `tags`, `tagSlugs`, `image`, `business` |
| `posts` | `index.njk`, `archive.njk` | Array of post objects |
| `pagination` | `index.njk`, `tag.njk`, `archive.njk` | `currentPage`, `totalPages`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage`, `pagePath` |
| `tag` | `tag.njk` | Tag object: `name`, `slug`, `description`, `posts` |
| `tags` | All templates | Array of tag objects: `name`, `slug`, `count`, `description` |
| `year` | `archive.njk` | Year string, e.g. `"2025"` |

## Image Management

### Overview

The `images:push` command uploads local media (images and videos) to Cloudflare R2, AWS S3, or any S3-compatible storage provider. Media files are organized by year in the `images/` directory and uploaded with their full directory structure preserved.

**Supported formats:**

- **Images:** JPG, JPEG, PNG, GIF, WebP, SVG
- **Video:** MP4

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
│       ├── tokyo-3.png
│       └── travel-vlog.mp4
└── 2025/
    └── new-post/
        ├── screenshot.jpg
        └── demo-video.mp4
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
    endpoint: process.env.S3_ENDPOINT, // Optional: for R2, etc.
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

#### `--content-assets`

Upload images that are co-located with markdown files instead of the top-level `assets/` directory.

When content is organized with images living alongside the markdown:

```
content/
├── 2024/
│   └── _assets/
│       ├── paris-cafe.webp
│       └── eiffel-tower.webp
└── 2025/
    └── _assets/
        └── tokyo-ramen.webp
```

Run:

```bash
bunki images:push --content-assets
```

This uploads each file with the S3 key `{year}/{filename}` — the `_assets/` segment is stripped. For example, `content/2024/_assets/paris-cafe.webp` becomes key `2024/paris-cafe.webp`, accessible at `https://cdn.example.com/2024/paris-cafe.webp`.

> [!IMPORTANT]
> Always use CDN URLs in your markdown, not relative `_assets/` paths. Relative paths cause the image files to be bundled into your Cloudflare Workers deployment instead of served from R2.

```markdown
<!-- ❌ Causes image to be bundled into Workers -->
![Paris](../2024/_assets/paris-cafe.webp)

<!-- ✅ Served from R2 CDN -->
![Paris](https://cdn.example.com/2024/paris-cafe.webp)
```

#### `--content-assets-dir <dir>`

Override the assets subdirectory name. Defaults to `_assets` (or `contentAssets.assetsDir` in `bunki.config.ts`).

```bash
# Use _images instead of _assets
bunki images:push --content-assets --content-assets-dir _images

# Use any custom name
bunki images:push --content-assets --content-assets-dir media
```

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

### Using Uploaded Videos in Markdown

Upload MP4 videos alongside your images and embed them in your posts:

```markdown
---
title: "Travel Vlog"
date: 2024-06-15T10:00:00
tags: [travel, video]
---

# My Paris Adventure

Watch my trip to Paris:

<video controls width="640" height="360">
  <source src="https://cdn.example.com/2024/paris-trip/travel-vlog.mp4" type="video/mp4">
  Your browser does not support HTML5 video.
</video>

## Behind the Scenes

Check out the making of the vlog:

<video controls width="640" height="360">
  <source src="https://cdn.example.com/2024/paris-trip/behind-scenes.mp4" type="video/mp4">
  Your browser does not support HTML5 video.
</video>
```

**Video Upload Example:**

```bash
# Upload all images and videos (including MP4 files)
bunki images:push

# Upload only 2024 videos and images
bunki images:push --min-year 2024

# Preview what would be uploaded without actually uploading
BUNKI_DRY_RUN=true bunki images:push --min-year 2024
```

**Video File Organization:**

Keep videos organized the same way as images for consistency:

```
images/
├── 2024/
│   └── travel-vlog/
│       ├── intro.mp4
│       ├── highlights.mp4
│       ├── thumbnail.jpg
│       └── poster.jpg
└── 2025/
    └── tutorial/
        ├── part-1.mp4
        ├── part-2.mp4
        └── preview.jpg
```

**Video Tips:**

1. **File Size**: Keep MP4 files optimized (under 50MB recommended)
   - Use tools like FFmpeg to compress before uploading
   - Example: `ffmpeg -i input.mp4 -crf 28 output.mp4`

2. **Format & Codec**:
   - Use H.264 video codec for best compatibility
   - Use AAC audio codec
   - Container: MP4 (.mp4 extension)

3. **Video Dimensions**:
   - Keep 16:9 aspect ratio for web
   - Common resolutions: 640x360, 1280x720, 1920x1080

4. **Hosting**:
   - MP4s benefit from CDN caching via S3/R2
   - Cloudflare R2 provides excellent video delivery
   - AWS S3 with CloudFront for additional acceleration

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

#### Content Assets Configuration

Configure co-located content assets in `bunki.config.ts`:

```typescript
import { SiteConfig } from "bunki";

export default (): SiteConfig => ({
  title: "My Blog",
  baseUrl: "https://example.com",
  domain: "example.com",

  // Default S3 config (used by bunki images:push)
  s3: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    bucket: "my-site-assets",
    endpoint: process.env.S3_ENDPOINT,
    region: "auto",
    publicUrl: "https://assets.example.com",
  },

  // Content assets: images stored alongside markdown in content/{year}/_images/
  contentAssets: {
    // Directory name within content/{year}/ (default: "_assets")
    assetsDir: "_images",

    // Optional: use a separate R2 bucket for content assets
    s3: {
      accessKeyId: process.env.IMG_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.IMG_SECRET_ACCESS_KEY || "",
      bucket: "my-blog-images",
      endpoint: process.env.S3_ENDPOINT,
      region: "auto",
      publicUrl: "https://img.example.com",
    },
  },
});
```

Then upload content assets:

```bash
# Uses contentAssets.assetsDir and contentAssets.s3 from config
bunki images:push --content-assets

# Override the directory name at the CLI level
bunki images:push --content-assets --content-assets-dir _media
```

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

## Incremental Builds

Bunki supports incremental builds for significantly faster rebuild times during development. When enabled, only changed content is reprocessed while unchanged files are loaded from cache.

### Performance Impact

**Large site example (455 posts):**

- Full build: 3,128ms
- Incremental build (no changes): 985ms (**3.2x faster**)

**Speedup breakdown:**

- Markdown parsing: 1,202ms → 55ms (**22x faster**)
- CSS processing: 1,024ms → 1ms (**1024x faster**)
- Overall: **68% faster builds**

### Usage

```bash
# Enable incremental builds
bunki generate --incremental

# First run (creates cache)
# Config changed, full rebuild required
# Total: 3,128ms (same as normal build)

# Subsequent runs (no changes)
# No content changes detected, using cached posts
# ✨ Loaded 455 posts from cache (0ms parsing)
# ⏭️  Skipping CSS (unchanged)
# Total: 985ms (3.2x faster!)

# When one file changes
# 📦 Incremental build: 1/456 files changed (~2730ms saved)
#    Parsed: 1 new/changed, loaded: 455 from cache
# Total: ~1,000ms
```

### How It Works

1. **First build** creates `.bunki-cache.json` with:
   - File hashes and modification times
   - Parsed post data (title, content, metadata)
   - CSS file checksums
   - Config file hash

2. **Subsequent builds** detect changes by comparing:
   - Config file hash (triggers full rebuild if changed)
   - Markdown file hashes/mtimes
   - CSS file hashes

3. **Selective processing**:
   - Only parse changed markdown files
   - Load unchanged posts from cache
   - Skip CSS if unchanged
   - Regenerate all pages (currently not selective)

### Cache Management

The cache is stored in `.bunki-cache.json` at your project root:

```bash
# View cache status
cat .bunki-cache.json | jq '.version, .configHash'

# Clear cache (force full rebuild)
rm .bunki-cache.json

# Exclude from version control
echo ".bunki-cache.json" >> .gitignore
```

### When to Use

**Recommended for:**

- Large sites (100+ posts)
- Development workflow with frequent rebuilds
- Sites with slow CSS processing (Tailwind, PostCSS)

**Not needed for:**

- Small sites (<50 posts) - already fast enough
- CI/CD builds - prefer clean full builds
- Production deployments - always use full builds

### Cache Format

Version 2.0.0 cache structure:

```json
{
  "version": "2.0.0",
  "configHash": "abc123",
  "files": {
    "/path/to/post.md": {
      "hash": "def456",
      "mtime": 1771720766417,
      "post": {
        "title": "Post Title",
        "date": "2024-01-01",
        "content": "...",
        "html": "..."
      }
    },
    "/path/to/main.css": {
      "hash": "ghi789",
      "mtime": 1771720800000
    }
  }
}
```

### Future Optimizations

Current implementation (v0.18.0) optimizes parsing and CSS processing. Future versions may add:

- Selective page regeneration (only rebuild changed posts)
- Incremental sitemap/RSS updates
- Smart index page regeneration

## CLI Commands

```bash
bunki init [--config FILE]                    # Initialize new site
bunki new <TITLE> [--tags TAG1,TAG2]          # Create new post
bunki generate [--config FILE]                # Build static site (full)
bunki generate --incremental                  # Build with caching (3x faster)
bunki validate [--config FILE]                # Validate frontmatter
bunki serve [--port 3000]                     # Start dev server
bunki css [--watch]                           # Process CSS
bunki images:push [--domain DOMAIN]           # Upload images to cloud
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

## Architecture

Bunki follows a **modular architecture** with single responsibility modules for maintainability and performance:

### Core Orchestrator

- **site-generator.ts** (282 lines) - Clean orchestrator coordinating all generation tasks
  - Uses dependency injection for testability
  - Parallel processing with Promise.all()
  - Minimal business logic (delegates to generators)

### Modular Generators

- **generators/feeds.ts** (285 lines) - RSS feed, sitemap, and robots.txt generation
- **generators/pages.ts** (357 lines) - HTML page generation with batched processing
- **generators/assets.ts** (115 lines) - CSS processing and static file copying

### Markdown Processing

- **utils/markdown/constants.ts** (71 lines) - Pre-compiled regex patterns, Schema.org types, icons
- **utils/markdown/validators.ts** (139 lines) - Frontmatter and business location validation
- **utils/markdown/parser.ts** (308 lines) - Markdown to HTML conversion with sanitization

### Reusable Utilities

- **utils/pagination.ts** (67 lines) - Pagination logic used across index, tags, and archives
- **utils/xml-builder.ts** (117 lines) - DRY XML/RSS building utilities
- **utils/markdown-utils.ts** (177 lines) - Main export file for backward compatibility

### Dependency Graph

```
site-generator.ts (orchestrator)
  ├── generators/feeds.ts → utils/xml-builder.ts
  ├── generators/pages.ts → utils/pagination.ts
  ├── generators/assets.ts
  └── utils/markdown/
      ├── constants.ts
      ├── validators.ts
      └── parser.ts
```

### Performance Optimizations

1. **Parallel Processing**: Independent tasks run simultaneously with Promise.all()
2. **Batched Operations**: Posts processed in batches of 10 for optimal throughput
3. **Pre-compiled Patterns**: Regex compiled once at module load, not on every parse
4. **O(1) Lookups**: Set-based validation instead of array.includes()
5. **Zero-Copy I/O**: Bun native APIs for kernel-level file transfers
6. **Content Hashing**: Bun.hash() for CSS cache busting without external dependencies

### Benefits

- ✅ **Clarity** - Easy to find and understand code
- ✅ **Testability** - Each module tested in isolation (424 tests)
- ✅ **Maintainability** - Changes isolated to specific modules
- ✅ **Reusability** - Modules can be imported independently
- ✅ **Performance** - Optimized at module level with Bun native APIs

## Features

- **Markdown Processing**: Frontmatter extraction, code highlighting, HTML sanitization
- **Relative Link Conversion**: Automatic conversion of relative markdown links (`../2023/post.md`) to absolute URLs (`/2023/post/`)
- **Frontmatter Validation**: Automatic validation of business location data with clear error messages
- **Security**: XSS protection, sanitized HTML, link hardening
- **High Performance**:
  - **Incremental builds** with smart caching (3.2x faster, 68% speedup)
  - Parallel page generation (40-60% faster builds)
  - Batched post processing (10x faster for 100+ posts)
  - Pre-compiled regex patterns (2-3x faster parsing)
  - O(1) Set-based validation (35x faster)
  - Zero-copy file operations (50% faster, lower memory)
  - Bun native APIs for optimal performance
- **Templating**: Nunjucks with custom filters and macros
- **Styling**: Built-in PostCSS support for modern CSS frameworks with content-based cache busting
- **Media Management**: Direct S3/R2 uploads for images and MP4 videos with URL mapping
- **Incremental Uploads**: Year-based filtering (`--min-year`) for large media collections
- **SEO**: Automatic RSS feeds, sitemaps, meta tags, and JSON-LD structured data
- **JSON-LD Structured Data**: Automatic Schema.org markup (BlogPosting, WebSite, Organization, BreadcrumbList)
- **Pagination**: Configurable posts per page with reusable pagination utilities
- **Archives**: Year-based and tag-based organization
- **Modular Architecture**: Single responsibility modules with comprehensive test coverage (424 tests)

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
│   ├── cli.ts                  # CLI interface
│   ├── config.ts               # Configuration management
│   ├── site-generator.ts       # Orchestrator (282 lines, was 957)
│   ├── server.ts               # Development server
│   ├── parser.ts               # Markdown parsing
│   ├── types.ts                # TypeScript types
│   ├── generators/             # Modular generation (NEW)
│   │   ├── feeds.ts           # RSS, sitemap, robots.txt (285 lines)
│   │   ├── pages.ts           # HTML generation with batching (357 lines)
│   │   └── assets.ts          # CSS & static file copying (115 lines)
│   └── utils/                  # Utility modules
│       ├── markdown/          # Markdown processing (NEW)
│       │   ├── constants.ts   # Pre-compiled patterns (71 lines)
│       │   ├── validators.ts  # Frontmatter validation (139 lines)
│       │   └── parser.ts      # Markdown → HTML (308 lines)
│       ├── pagination.ts      # Pagination utilities (67 lines, NEW)
│       ├── xml-builder.ts     # XML/RSS builders (117 lines, NEW)
│       ├── markdown-utils.ts  # Main export file (177 lines, was 576)
│       ├── css-processor.ts   # PostCSS + Bun.hash()
│       ├── file-utils.ts      # Bun native file ops
│       ├── date-utils.ts      # Date/time utilities
│       ├── json-ld.ts         # JSON-LD schema generation
│       ├── image-uploader.ts  # Image upload logic
│       └── s3-uploader.ts     # S3/R2 client
├── test/                       # Test suite (424 tests, mirrors src/)
│   ├── utils/
│   │   ├── markdown/          # Modular tests (NEW)
│   │   │   ├── constants.test.ts   (25 tests)
│   │   │   ├── validators.test.ts  (21 tests)
│   │   │   └── parser.test.ts      (17 tests)
│   │   ├── pagination.test.ts      (15 tests, NEW)
│   │   ├── xml-builder.test.ts     (13 tests, NEW)
│   │   └── ...
│   ├── cli/commands/
│   ├── security/
│   └── ...
├── templates/                  # Example templates
├── fixtures/                   # Test fixtures
└── dist/                       # Built output
```

## Changelog

### v0.19.0 (Current)

- **Template Fragments**: Built-in reusable Nunjucks macros available in all site templates
  - `og-image.njk` — `og_image(post, site)` and `twitter_image(post, site)` for Open Graph / Twitter Card image tags
  - `json-ld.njk` — `blog_posting_schema(post, site)` and `local_business_schema(post, site)` for Schema.org structured data
  - `share-buttons.njk` — `share_buttons(post, site)` for X / Facebook / LinkedIn / Email share buttons (Tailwind)
  - `pagination.njk` — `pagination_nav(pagination)` for previous/next navigation (Tailwind)
  - Fragments are registered as a second Nunjucks search path; site templates take priority over built-in fragments
- **Improved init templates**: `bunki init` now generates templates with canonical URLs, Open Graph meta tags, Twitter Cards, RSS feed link, share buttons, and JSON-LD structured data out of the box
- **Template variables reference**: Added documentation for all variables available in each template type

### v0.18.1

- **Page Generation Optimization**: Cache JSON-LD schemas and metadata during initialization
  - Eliminates 910 redundant operations per build (455 posts × 2)
  - `extractFirstImageUrl()` called once during initialization, cached in `post.image`
  - Word count calculated once, cached in `post.wordCount`
  - JSON-LD schemas pre-generated and cached in `post.jsonLd`
  - Removed duplicate schema generation from page and feed generators
- **Deployment Optimization**: All deploy commands now use incremental builds by default
  - `deploy:all` now builds incrementally for faster deployments
  - Individual site deployments also use incremental builds
  - Full builds available via `build:full` when needed

### v0.18.0

- **Incremental Builds**: Smart caching for 3.2x faster development builds
  - File change detection using content hashing and modification times
  - Selective markdown parsing (only parse changed files)
  - CSS caching (skip processing if unchanged)
  - Cache format v2.0.0 stores full parsed post data
  - Automatic config change detection triggers full rebuilds
  - `.bunki-cache.json` stores file hashes, mtimes, and parsed posts
- **Performance Results** (455 posts):
  - Full build: 3,128ms
  - Incremental (no changes): 985ms (68% faster)
  - Markdown parsing: 1,202ms → 55ms (22x faster)
  - CSS processing: 1,024ms → 1ms (1024x faster)
- **CLI Enhancement**: New `--incremental` flag for `bunki generate`
- **Code Cleanup**: Removed unused imports, reverted template extraction

### v0.17.0

- **Major Architecture Refactoring**: Modular design with single responsibility modules
  - Split `site-generator.ts` from 957 to 282 lines (-70%)
  - Split `markdown-utils.ts` from 576 to 177 lines (-69%)
  - Created 3 new generator modules: feeds, pages, assets
  - Created 3 new markdown modules: constants, validators, parser
  - Created 2 new utility modules: pagination, xml-builder
- **Performance Improvements**:
  - Parallel page generation with Promise.all() (40-60% faster builds)
  - Batched post processing (10x faster for 100+ posts)
  - Pre-compiled regex patterns (2-3x faster markdown parsing)
  - O(1) Set-based validation (35x faster validation)
  - Zero-copy file operations using Bun native APIs (50% faster, lower memory)
  - Content-based CSS cache busting with Bun.hash()
- **DRY Improvements**:
  - Extracted pagination utilities (saved 80+ lines)
  - Created XML builder utilities (saved 150+ lines)
  - Reusable page writing utilities (saved 40+ lines)
- **Enhanced Test Coverage**:
  - Added 87 new tests (337 → 424 tests total)
  - Modular test organization mirroring source structure
  - 100% backward compatible with existing API
- **Code Reduction**: Eliminated 1,074 lines while adding 11 focused modules

### v0.16.0

- **Relative Link Conversion**: Automatically convert relative markdown links to absolute URLs
  - Supports `../2023/post.md` → `/2023/post/` conversion during build time
  - Works with multiple parent directories (`../../`, `../../../`, etc.)
  - Preserves link text and formatting
  - Enables cleaner internal cross-references in markdown files
- **Comprehensive Testing**: Added 13 new tests for relative link conversion
- **Zero Configuration**: Works automatically without any setup required

### v0.15.0

- **Frontmatter Validation**: Automatic validation of business location data
  - Enforces `business:` field (rejects deprecated `location:`)
  - Enforces `lat:`/`lng:` coordinates (rejects deprecated `latitude:`/`longitude:`)
  - Validates required fields (type, name, lat, lng)
  - Clear error messages with suggestions for fixes
  - New `bunki validate` command for standalone validation
- **Enhanced Testing**: 47 tests for markdown parsing and validation
- **Breaking Change**: Deprecated `location:`, `latitude:`, and `longitude:` fields now rejected

### v0.8.0

- **JSON-LD Structured Data**: Automatic Schema.org markup generation for enhanced SEO
  - BlogPosting schema for individual blog posts with author, keywords, images
  - WebSite schema for homepage with search action
  - Organization schema for publisher information
  - BreadcrumbList schema for navigation hierarchy
  - Automatic featured image extraction from post content
- **Comprehensive SEO**: Complete structured data support following Google best practices
- **Zero configuration**: JSON-LD automatically generated during site build
- **Well documented**: Extensive README section with examples and validation tools
- **Fully tested**: 60+ new tests covering all JSON-LD schema types

### v0.7.0

- **Media uploads**: Added MP4 video support alongside image uploads
- **Incremental uploads**: Year-based filtering with `--min-year` option
- **Enhanced documentation**: Comprehensive video upload guide with examples
- **Test coverage**: Added 10+ tests for image/video uploader functionality
- **Fixed timestamps**: Stable dates in test fixtures to prevent flipping

### v0.6.1

- Version bump and welcome date stabilization
- Test formatting improvements
- Code style consistency updates

### v0.5.3

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
