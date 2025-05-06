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

## Installation

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

You can also use Bunki programmatically in your own Node.js or Bun scripts:

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

## License

MIT