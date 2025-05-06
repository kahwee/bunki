# Bunki

[![GitHub license](https://img.shields.io/github/license/kahwee/bunki)](https://github.com/kahwee/bunki/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/kahwee/bunki)](https://github.com/kahwee/bunki/issues)
[![Coverage Status](https://coveralls.io/repos/github/kahwee/bunki/badge.svg?branch=main)](https://coveralls.io/github/kahwee/bunki?branch=main)

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

## Installation

> **IMPORTANT**: Bunki requires Bun v1.2.11 or later as its runtime. It is not compatible with Node.js and will not work with npm, yarn, or pnpm.

### Prerequisites
```bash
# Install Bun if you don't have it
curl -fsSL https://bun.sh/install | bash

# Verify Bun version (should be 1.2.11 or later)
bun --version
```

### From npm (Coming soon)
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
date: 2023-01-01T12:00:00Z
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

## Programmatic Usage

You can also use Bunki programmatically in your own Bun scripts:

```javascript
import { SiteGenerator, loadConfig } from 'bunki';
import path from 'path';

// Load configuration
const config = loadConfig('bunki.config.json');

// Create a generator
const generator = new SiteGenerator({
  contentDir: path.join(process.cwd(), 'content'),
  outputDir: path.join(process.cwd(), 'dist'),
  templatesDir: path.join(process.cwd(), 'templates'),
  config
});

// Generate site
async function generate() {
  await generator.initialize();
  await generator.generate();
  console.log('Site generation complete!');
}

generate().catch(console.error);
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

Code coverage reports are automatically generated and displayed on GitHub through a badge at the top of this README. You can also view detailed coverage reports on [Coveralls](https://coveralls.io/github/kahwee/bunki).

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
│   └── 2024/           
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