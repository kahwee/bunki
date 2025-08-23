# Bunki

# Bunki

Fast static site generator for blogs/docs built with Bun. Core features: Markdown + frontmatter, tags, year archives, pagination, RSS, sitemap, secure sanitized HTML, syntax highlighting, optional PostCSS pipeline, image uploading (S3/R2), tiny Nunjucks templates.

## Install

```bash
bun install bunki        # add locally
bun install -g bunki     # or global
npm i bunki              # Node (>=18)
```

Requires Bun >= 1.2.20 (recommended runtime).

## Quick Start

```bash
bunki init
bunki new "Hello World" --tags web,notes
bunki generate
bunki serve  # http://localhost:3000
```

## Minimal Config (bunki.config.ts)

```ts
import { SiteConfig } from "bunki";
export default (): SiteConfig => ({
  title: "My Blog",
  description: "Thoughts",
  baseUrl: "https://example.com",
  domain: "example.com",
  css: {
    input: "templates/styles/main.css",
    output: "css/style.css",
    postcssConfig: "postcss.config.js",
    enabled: true,
  }, // optional
  s3: {
    // optional image upload
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET || "",
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION || "auto",
    publicUrl: process.env.R2_PUBLIC_URL || "",
  },
});
```

## Frontmatter

```markdown
---
title: "Post Title"
date: 2025-01-15T09:00:00-07:00
tags: [web, performance]
excerpt: Optional summary
---
```

Optional tag descriptions: `src/tags.toml`:

```toml
performance = "Speed & optimization"
web = "General web dev"
```

## CSS (Tailwind example)

```bash
bun add -D tailwindcss @tailwindcss/postcss @tailwindcss/typography
```

`postcss.config.js`:

```js
module.exports = { plugins: [require("@tailwindcss/postcss")] };
```

`templates/styles/main.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Processed automatically during `bunki generate`.

## Images

Env vars (R2 / S3):

```
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_ENDPOINT=...
R2_PUBLIC_URL=https://cdn.example.com
```

Upload:

```bash
bunki images:push --images ./images --output-json image-map.json
```

## Programmatic

```ts
import { SiteGenerator, loadConfig } from "bunki";
const cfg = await loadConfig("./bunki.config.ts");
const gen = new SiteGenerator({
  contentDir: "content",
  outputDir: "dist",
  templatesDir: "templates",
  config: cfg,
});
await gen.initialize();
await gen.generate();
```

## CLI

```
init | new | generate | serve | images:push | css
```

## Output

```
- 📱 **Mobile-first** responsive templates
  index.html
  feed.xml
  sitemap.xml
  2025/... per-post dirs
  tags/... tag pages
  css/style.css (if enabled)
```

## Security

HTML sanitized; external links hardened; unsafe tags stripped.

## Changelog

v0.3.1 (this release)

- Export map + sideEffects=false for tree-shaking
- Prepack build cleanup
- Concise docs & publish prep

v0.3.0

- PostCSS pipeline + `css` command

## Contribute

```bash
bun install
bun run build
bun test
```

## License

MIT © KahWee Teng

- ⚡ **Simple CLI interface** with intuitive commands

## 🛠️ PostCSS Integration

Bunki v0.3.0+ includes built-in PostCSS processing, allowing you to use modern CSS frameworks like Tailwind CSS while keeping framework-specific dependencies in your project:

### CSS Configuration

Configure CSS processing in your `bunki.config.ts`:

```typescript
export default function (): SiteConfig {
  return {
    title: "My Blog",
    description: "A blog built with Bunki",
    baseUrl: "https://example.com",
    domain: "blog",
    // CSS processing configuration
    css: {
      input: "templates/styles/main.css", // Input CSS file
      output: "css/style.css", // Output path in dist
      postcssConfig: "postcss.config.js", // PostCSS config file
      enabled: true, // Enable CSS processing
      watch: false, // Watch for changes (dev mode)
    },
    // ... other config
  };
}
```

### CSS Processing Commands

```bash
# Process CSS as part of site generation
bunki generate

# Process CSS standalone
bunki css

# Watch CSS files for changes (development)
bunki css --watch
```

### Framework Integration Example (Tailwind CSS)

1. **Install Tailwind in your project** (not in bunki):

```bash
bun add -D tailwindcss @tailwindcss/postcss @tailwindcss/typography
```

2. **Create `postcss.config.js`**:

```javascript
module.exports = {
  plugins: [require("@tailwindcss/postcss")],
};
```

3. **Create `tailwind.config.js`**:

```javascript
module.exports = {
  content: ["./content/**/*.{md,mdx}", "./templates/**/*.{njk,html}"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
```

4. **Create your CSS file** (`templates/styles/main.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Bunki will process your CSS through PostCSS and Tailwind, generating optimized output in your `dist` directory.

## 📦 Installation

> **IMPORTANT**: Bunki requires Bun v1.2.20 or later as its runtime. It also works with Node.js v18+ but Bun is recommended for optimal performance.

### Prerequisites

```bash
# Install Bun if you don't have it
curl -fsSL https://bun.sh/install | bash

# Verify Bun version (should be 1.2.20 or later)
bun --version
```

### Installation Options

```bash
# Install globally with Bun
bun install -g bunki

# Or with npm
npm install -g bunki

# Or install locally in your project
bun install bunki
# or
npm install bunki

# Or from GitHub for development
git clone git@github.com:kahwee/bunki.git
cd bunki
bun install
bun run build
bun link
```

## 🚀 Quick Start

### Initialize a New Site

```bash
# Create a new site with default templates and configuration
bunki init

# This creates:
# - bunki.config.ts (configuration)
# - content/ (for markdown posts)
# - templates/ (Nunjucks templates)
# - public/ (static assets)
```

### Add Content

Create markdown files in the `content` directory with frontmatter:

````markdown
---
title: Your Post Title
date: 2025-01-01T09:00:00-07:00
tags: [web-development, javascript]
---

# Your Post Title

Your post content goes here with **markdown** support!

```javascript
console.log("Code highlighting works too!");
```
````

````

Or use the CLI to create a new post:

```bash
bunki new "Your Post Title" --tags "web-development, javascript"
````

### Generate Your Site

```bash
# Generate the static site (includes CSS processing)
bunki generate
```

### Preview Your Site

```bash
# Start a local development server
bunki serve

# Custom port
bunki serve --port 3000
```

## ⚙️ Configuration

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

    // CSS processing configuration
    css: {
      input: "templates/styles/main.css",
      output: "css/style.css",
      postcssConfig: "postcss.config.js",
      enabled: true,
      watch: false,
    },

    // Cloud storage configuration for images
    publicUrl: process.env.R2_PUBLIC_URL,
    s3: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      bucket: process.env.R2_BUCKET || "",
      endpoint: process.env.R2_ENDPOINT,
      region: process.env.R2_REGION || "auto",
    },
  };
}
```

## 🖼️ Image Management

Bunki uses Bun's native S3 API for efficient image uploads to S3-compatible services like Cloudflare R2.

### Environment Configuration

Create a `.env` file with your storage credentials:

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket
R2_PUBLIC_URL=https://your-cdn-url.com
```

For domain-specific custom domains:

```env
R2_CUSTOM_DOMAIN_EXAMPLE_COM=cdn.example.com
```

### Upload Commands

```bash
# Upload all images from the images/ directory
bunki images:push

# Specify a different images directory
bunki images:push --images path/to/images

# Output URL mapping to a JSON file for reference
bunki images:push --output-json image-urls.json

# Upload for a specific domain
bunki images:push --domain example.com
```

Supported formats: **JPG**, **PNG**, **GIF**, **WebP**, **SVG**

## 📁 Directory Structure

```
my-blog/
├── bunki.config.ts         # Site configuration
├── postcss.config.js       # PostCSS configuration (optional)
├── tailwind.config.js      # Tailwind config (if using Tailwind)
├── .env                    # Environment variables
├── content/                # Markdown content
│   └── 2025/               # Year-based organization
│       ├── my-first-post.md
│       └── another-post.md
├── templates/              # Nunjucks templates
│   ├── base.njk           # Base layout
│   ├── index.njk          # Homepage
│   ├── post.njk           # Post template
│   ├── tag.njk            # Tag page
│   ├── tags.njk           # Tags index
│   ├── archive.njk        # Year archive
│   └── styles/            # CSS source files
│       └── main.css       # Main stylesheet
├── images/                 # Local images (uploaded to cloud)
├── public/                # Static assets (copied to dist)
├── src/                   # Tag descriptions
│   └── tags.toml          # Tag metadata
└── dist/                  # Generated site (output)
    ├── index.html
    ├── css/
    │   └── style.css      # Processed CSS
    ├── 2025/
    │   └── my-first-post/
    │       └── index.html
    ├── tags/
    ├── feed.xml           # RSS feed
    └── sitemap.xml        # Sitemap
```

## 🚨 CLI Commands

```bash
Usage: bunki [options] [command]

Commands:
  init [options]            Initialize a new site with templates
  new [options] <title>     Create a new blog post
  generate [options]        Generate static site from content
  css [options]             Process CSS using PostCSS
  serve [options]           Start local development server
  images:push [options]     Upload images to cloud storage
  help [command]            Display help for command

Options:
  -V, --version            Display version number
  -h, --help               Display help for command
```

### Detailed Command Options

```bash
# Initialize new site
bunki init --config custom.config.ts

# Create new post
bunki new "My Post Title" --tags "javascript, web-dev"

# Generate with custom options
bunki generate --config bunki.config.ts --output dist

# CSS processing
bunki css --watch              # Watch for changes
bunki css --output dist        # Custom output directory

# Development server
bunki serve --port 3000        # Custom port
bunki serve --output dist      # Serve from custom directory

# Image upload
bunki images:push --domain example.com
bunki images:push --images custom/path --output-json mapping.json
```

## 🏗️ Development

### Prerequisites for Contributors

```bash
git clone git@github.com:kahwee/bunki.git
cd bunki
bun install
```

### Development Commands

```bash
# Build the project
bun run build

# Run in development mode with watch
bun run dev

# Run tests
bun test

# Run tests with coverage
bun test:coverage

# Watch tests
bun test:watch

# Type checking
bun run typecheck

# Format code
bun run format

# Clean build artifacts
bun run clean
```

### Project Structure

```
bunki/
├── src/
│   ├── cli.ts              # CLI interface
│   ├── config.ts           # Configuration management
│   ├── site-generator.ts   # Core site generation
│   ├── server.ts           # Development server
│   ├── parser.ts           # Markdown parsing
│   ├── types.ts            # TypeScript types
│   └── utils/
│       ├── css-processor.ts    # PostCSS integration
│       ├── file-utils.ts       # File operations
│       ├── image-uploader.ts   # Image cloud upload
│       ├── markdown-utils.ts   # Markdown processing
│       └── s3-uploader.ts      # S3 API client
├── test/                   # Test files
├── fixtures/               # Test fixtures
└── dist/                   # Built output
```

## 📋 Changelog

### v0.3.0 (Latest)

- ✨ **NEW**: PostCSS integration with configurable CSS processing
- ✨ **NEW**: CSS watch mode for development
- ✨ **NEW**: Framework-agnostic CSS support (Tailwind, etc.)
- 🔄 **IMPROVED**: Enhanced CLI with `css` command
- 🔄 **IMPROVED**: Better error handling and fallbacks
- 🐛 **FIXED**: Directory existence validation for development server
- 📚 **DOCS**: Comprehensive PostCSS integration guide

### v0.2.6

- 🐛 **FIXED**: Server directory existence check
- 🔄 **IMPROVED**: Error handling and logging
- 📚 **DOCS**: Enhanced documentation

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and feel free to submit issues and pull requests.

### Areas for Contribution

- 🐛 Bug fixes and improvements
- 📝 Documentation improvements
- 🧪 Additional test coverage
- ✨ New features (CSS plugins, template engines, etc.)
- 🎨 Template improvements

## 📄 License

MIT © [KahWee Teng](https://github.com/kahwee)

---

## 🙋‍♂️ Support

- 📚 [Documentation](https://github.com/kahwee/bunki)
- 🐛 [Issues](https://github.com/kahwee/bunki/issues)
- 💬 [Discussions](https://github.com/kahwee/bunki/discussions)

Built with ❤️ using [Bun](https://bun.sh)
