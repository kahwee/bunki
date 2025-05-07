# CLAUDE.md - Bunki Configuration Guide

## Runtime Environment

This project uses [Bun](https://bun.sh/) v1.2.12 as its JavaScript runtime and package manager. Bun provides significantly better performance than Node.js for both development and production workflows.

### Setup Requirements

1. Install Bun v1.2.12:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   bun upgrade --version 1.2.12
   ```
2. Clone repository: `git clone git@github.com:kahwee/bunki.git`
3. Install dependencies: `bun install`

### Build & Run Commands

- Build: `bun run build`
- Development: `bun run dev`
- Generate static site: `bun run generate`
- Serve the site: `bun run serve`
- Type check: `bun run typecheck`
- Run tests: `bun test`
- Run tests with coverage: `bun test:coverage`

## Code Style Guidelines

- **TypeScript**: Strict typing with interfaces in `types.ts`
- **Imports**: Use ES modules style imports with explicit named imports
- **Error Handling**: Use async/await with try/catch blocks
- **Naming**: PascalCase for interfaces, camelCase for variables/functions
- **File Naming**: Use kebab-case for filenames
- **Formatting**: 2-space indentation, semi-colons required
- **Templates**: Use Nunjucks templates with .njk extension
- **CSS**: Use CSS in the templates/styles directory with CSS variables
- **Native APIs**: Prefer Bun's native APIs (e.g., Glob, File) when available
- **Date Format**: Use timezone-aware ISO format with PST/PDT timezone in Markdown frontmatter:
  `date: YYYY-MM-DDT09:00:00-07:00`

## Project Structure

```
.
├── bunki.config.ts/json  # Site configuration
├── content/              # Markdown content
│   └── YYYY/             # Year-based content organization
│       └── slug-name.md  # Markdown files with frontmatter
├── templates/            # Nunjucks templates
│   ├── base.njk          # Base template
│   ├── index.njk         # Homepage template
│   ├── post.njk          # Single post template
│   ├── tag.njk           # Tag page template
│   ├── tags.njk          # Tags index template
│   ├── archive.njk       # Archives template
│   └── styles/           # CSS directory
│       └── main.css      # Main stylesheet
├── images/               # Local images directory
│   └── domain.com/       # Domain-specific image directory
├── src/                  # Source code
└── dist/                 # Generated site output
```

## Tag System

Tags and their descriptions are defined in `src/tags.toml` and displayed on tag pages. Use lowercase for all tags and prioritize existing ones over creating new ones.

## Image Management

Images are stored in Cloudflare R2 or S3-compatible storage (not in Git).

### Image Configuration

Create a `.env` file with S3/R2 credentials:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID` 
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL`

For domain-specific custom domains, you can set:
```
R2_CUSTOM_DOMAIN_EXAMPLE_COM=cdn.example.com
```

### Image Upload Method

Bunki uses Bun's native S3 API for image uploads:

```bash
# Upload all images in the images directory
bunki images:push

# Specify a different images directory
bunki images:push --images path/to/images

# Output URL mapping to a JSON file
bunki images:push --output-json image-urls.json
```

The image uploader supports JPG, PNG, GIF, WebP, and SVG formats.