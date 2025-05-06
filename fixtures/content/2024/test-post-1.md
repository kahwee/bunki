---
title: "Testing Bunki: A New Static Site Generator"
date: 2024-01-15T09:00:00-07:00
tags: [technology, web development, open source]
excerpt: Bunki is a fast, opinionated static site generator built with Bun. This test post explores its capabilities, performance benefits, and how it compares to other static site generators.
---

# Testing Bunki: A New Static Site Generator

Bunki is an innovative [static site generator](/tags/web-development/) built with [Bun](https://bun.sh), designed to create lightning-fast blogs and simple websites with minimal configuration.

## Key Features

Bunki comes with several powerful features out of the box:

- **Markdown Support**: Write content in Markdown with frontmatter for metadata
- **Tag System**: Organize posts with tags and generate tag pages automatically
- **Fast Performance**: Leverages Bun's native APIs for maximum speed
- **Syntax Highlighting**: Code blocks are automatically highlighted
- **Responsive Design**: Mobile-friendly templates right out of the box

## Code Example

Here's a simple example of how to use Bunki in your JavaScript project:

```javascript
import { SiteGenerator } from "bunki";

// Create a generator
const generator = new SiteGenerator({
  contentDir: "./content",
  outputDir: "./dist",
  templatesDir: "./templates",
  config: {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "example.com",
  },
});

// Generate site
async function generate() {
  await generator.initialize();
  await generator.generate();
  console.log("Site generation complete!");
}

generate().catch(console.error);
```

## Performance Comparison

When compared to other static site generators, Bunki offers significant performance improvements:

| Generator | Build Time | Memory Usage |
| --------- | ---------- | ------------ |
| Bunki     | 0.5s       | 32MB         |
| Hugo      | 1.2s       | 67MB         |
| Gatsby    | 8.7s       | 512MB        |
| Jekyll    | 5.3s       | 128MB        |

_These numbers are from a test blog with 100 posts on an M1 MacBook Pro_

## Getting Started

To get started with Bunki, you'll need to have Bun installed:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Bunki globally
bun install -g bunki

# Create a new site
bunki init

# Generate your site
bunki generate

# Serve your site locally
bunki serve
```

This project is still in early development but already shows promise as a high-performance alternative to existing static site generators.
