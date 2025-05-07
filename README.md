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
- Cloud image uploading via Cloudflare R2

## Installation

> **IMPORTANT**: Bunki requires Bun v1.2.11 or later as its runtime. It is not compatible with Node.js and will not work with npm, yarn, or pnpm.

### Prerequisites

```bash
# Install Bun if you don't have it
curl -fsSL https://bun.sh/install | bash

# Verify Bun version (should be 1.2.11 or later)
bun --version
```

### From bun

```bash
# Install globally
bun install -g bunki

# Or install locally in your project
bun install bunki
```

### From GitHub

```bash
# Clone the repository
git clone git@github.com:kahwee/bunki.git
cd bunki

# Install dependencies
bun install

# Build the project
bun run build

# Link for local development
bun link
```

## Quick Start

### Initialize a New Site

```bash
# Create a new site with default templates and configuration
bunki init
```

This will:

- Create a default configuration file (`bunki.config.json`)
- Set up the required directory structure
- Create default templates
- Add a sample blog post

### Add Content

Create markdown files in the `content` directory with frontmatter:

```markdown
---
title: Your Post Title
date: 2025-01-01T12:00:00Z
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

Then visit http://localhost:3000 in your browser.

## Configuration

The `bunki.config.json` file contains the configuration for your site:

```json
{
  "title": "My Blog",
  "description": "A blog built with Bunki",
  "baseUrl": "https://example.com",
  "domain": "blog"
}
```

### Image Upload Configuration

To configure image uploading to Cloudflare R2, you need to set the following environment variables:

```
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_PUBLIC_URL=https://your-r2-public-url.com
```

You can add these to a `.env` file in your project root. The bucket name will be automatically generated from your domain name (e.g., `example.com` becomes `example-com`).

For domain-specific custom domains, you can optionally set:

```
R2_CUSTOM_DOMAIN_EXAMPLE_COM=cdn.example.com
```

This will use `https://cdn.example.com/` as the base URL for all uploaded images.

## Directory Structure

```
.
├── bunki.config.json   # Configuration file
├── content/            # Markdown content
│   ├── post1.md
│   └── post2.md
├── templates/          # Nunjucks templates
│   ├── base.njk
│   ├── index.njk
│   ├── post.njk
│   ├── tag.njk
│   ├── tags.njk
│   ├── archive.njk
│   └── styles/
│       └── main.css
├── public/             # Static files to copy to the site
│   └── favicon.ico
├── images/             # Image storage directory
│   └── example.com/    # Domain-specific images
└── dist/               # Generated site
    ├── index.html
    ├── css/
    │   └── style.css
    └── ...
```

## Templates

Bunki uses [Nunjucks](https://mozilla.github.io/nunjucks/) for templating. The templates should be placed in the `templates` directory. The default templates provide a solid starting point for most blogs.

## Command Line Interface

```
Usage: bunki [options] [command]

An opinionated static site generator built with Bun

Options:
  -V, --version         output the version number
  -h, --help            display help for command

Commands:
  init [options]        Initialize a new site with default structure
  new [options] <title> Create a new blog post
  generate [options]    Generate static site from markdown content
  serve [options]       Start a local development server
  init-images [options] Initialize directory structure for storing images
  upload-images [options] Upload images to remote storage (e.g., Cloudflare R2)
  help [command]        display help for command
```

### Initialize Command

```
Usage: bunki init [options]

Initialize a new site with default structure

Options:
  -c, --config <file>  Path to config file (default: "bunki.config.json")
  -h, --help           display help for command
```

### New Post Command

```
Usage: bunki new [options] <title>

Create a new blog post

Arguments:
  title                Title of the post

Options:
  -t, --tags <tags>    Comma-separated list of tags (default: "")
  -h, --help           display help for command
```

### Generate Command

```
Usage: bunki generate [options]

Generate static site from markdown content

Options:
  -c, --config <file>    Config file path (default: "bunki.config.json")
  -c, --content <dir>    Content directory (default: "content")
  -o, --output <dir>     Output directory (default: "dist")
  -t, --templates <dir>  Templates directory (default: "templates")
  -h, --help             display help for command
```

### Serve Command

```
Usage: bunki serve [options]

Start a local development server

Options:
  -o, --output <dir>   Output directory (default: "dist")
  -p, --port <number>  Port number (default: "3000")
  -h, --help           display help for command
```

### Initialize Images Command

```
Usage: bunki init-images [options]

Initialize directory structure for storing images

Options:
  -i, --images <dir>   Images directory path (default: "images")
  -h, --help           display help for command
```

### Image Upload Commands

#### Upload Multiple Images

```
Usage: bunki upload-images [options]

Upload images to remote storage (e.g., Cloudflare R2)

Options:
  -d, --domain <domain>     Domain name (defaults to domain in bunki.config.json)
  -i, --images <dir>        Images directory path (default: "images")
  -t, --type <type>         Upload storage type (currently only r2 is supported) (default: "r2")
  --output-json <file>      Output URL mapping to JSON file
  -h, --help                display help for command
```

This command will find and upload all supported image files (JPG, PNG, GIF, WebP, SVG) in the specified directory.

#### Upload Single Image

```
Usage: bunki upload-image <imagePath> [options]

Upload a single image to remote storage (e.g., Cloudflare R2)

Arguments:
  imagePath               Path to the image file to upload

Options:
  -d, --domain <domain>   Domain name (defaults to domain in bunki.config.json)
  -t, --type <type>       Upload storage type (currently only r2 is supported) (default: "r2")
  -h, --help              display help for command
```

#### Quick Upload Script

Bunki also includes a convenient shell script for quick image uploads:

```bash
# Upload a single image using the shell script
./upload-image.sh path/to/your/image.jpg

# Optionally specify the domain
./upload-image.sh path/to/your/image.jpg example.com
```

After uploading, the tool will display the public URL of the uploaded image along with the markdown syntax to use it in your content:

```
Image uploaded successfully!
Use this URL in your markdown: ![Alt text](https://your-r2-url.com/example-com/image.jpg)
```

## Programmatic Usage

You can also use Bunki programmatically in your own Bun scripts:

### Site Generation

```javascript
import { SiteGenerator, loadConfig } from "bunki";
import path from "path";

// Load configuration
const config = loadConfig("bunki.config.json");

// Create a generator
const generator = new SiteGenerator({
  contentDir: path.join(process.cwd(), "content"),
  outputDir: path.join(process.cwd(), "dist"),
  templatesDir: path.join(process.cwd(), "templates"),
  config,
});

// Generate site
async function generate() {
  await generator.initialize();
  await generator.generate();
  console.log("Site generation complete!");
}

generate().catch(console.error);
```

### Image Uploading

```javascript
import {
  uploadImages,
  uploadSingleImage,
  initImages,
  DEFAULT_IMAGES_DIR,
} from "bunki";
import path from "path";

// Initialize image directories
async function setupImages() {
  await initImages({
    images: path.join(process.cwd(), "images"),
  });

  // Upload all images in a directory
  const imageUrlMap = await uploadImages({
    domain: "example.com",
    images: DEFAULT_IMAGES_DIR,
    type: "r2",
    outputJson: "image-urls.json",
  });

  console.log("Image URLs:", imageUrlMap);

  // Upload a single image
  const singleImageUrl = await uploadSingleImage({
    imagePath: path.join(process.cwd(), "path/to/image.jpg"),
    domain: "example.com",
    type: "r2",
  });

  console.log("Single image URL:", singleImageUrl);
}

setupImages().catch(console.error);
```

> **Note**: Bunki's programmatic API is designed specifically for Bun and utilizes Bun's native APIs for optimal performance. It will not work in Node.js environments.

## Development

### Testing

Bunki includes a comprehensive test suite to verify functionality:

```bash
# Run all tests
bun test

# Run specific test files
bun test site-generator
bun test utils/markdown

# Run tests with watch mode
bun test --watch

# Run tests with coverage
bun test:coverage
```

Code coverage reports are automatically generated during testing.

Tests are written using Bun's native test runner and verify all core functionality of Bunki, including:

- Site generation process
- Markdown parsing and rendering
- Configuration handling
- File system utilities
- Template rendering

### Test Fixtures

Bunki comes with a set of test fixtures that are used by the test suite and can also serve as examples:

The fixture directory includes:

```
fixtures/
├── bunki.config.json   # Test configuration file
├── content/            # Sample markdown content
│   └── 2025/
│       ├── test-post-1.md
│       ├── performance-optimization.md
│       └── migrating-from-gatsby.md
├── src/
│   └── tags.toml       # Tag definitions
└── templates/          # Test templates
    ├── base.njk
    ├── index.njk
    ├── post.njk
    └── styles/
        └── main.css
```

You can use these fixtures as examples for your own Bunki projects.

## License

MIT
