# CLAUDE.md - Agentic Coding Assistant Configuration

## Runtime Environment

This project uses [Bun](https://bun.sh/) v1.2.11 exclusively as its JavaScript runtime and package manager. Bun provides significantly better performance than Node.js/npm for both development and production workflows, including optimized file operations through its native Glob and File APIs.

### Setup Requirements

1. Install Bun v1.2.11:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   bun upgrade --version 1.2.11
   ```
2. Clone repository: `git clone git@github.com:kahwee/bunki.git`
3. Install dependencies: `bun install`

Do not use npm/yarn/pnpm with this project - only use Bun v1.2.11 for all operations.

### Version Check

Before starting development, verify your Bun version:

```bash
bun --version
# Should output: 1.2.11
```

## Build & Run Commands

- Build: `bun run build` (targets Bun runtime for native APIs)
- Development: `bun run dev`
- Generate static site: `bun run generate`
- Serve the site: `bun run serve`
- Deploy to Cloudflare: `bun run deploy`
- Initialize image directories: `bun run init-images`
- Upload images: `bun run upload-images`
- Quick image upload script: `./upload-image.sh path/to/image.jpg`

## Code Style Guidelines

- **TypeScript**: Strict typing with interfaces in `types.ts`
- **Imports**: Use ES modules style imports with explicit named imports
- **Error Handling**: Use async/await with try/catch blocks
- **Naming**: PascalCase for interfaces, camelCase for variables/functions
- **File Organization**: Separate concerns (config, parser, generator)
- **File Naming**: Use kebab-case for filenames (e.g., `file-scanner.ts` not `fileScanner.ts`)
- **Formatting**: 2-space indentation, semi-colons required
- **Command Pattern**: Use commander.js for CLI commands
- **Environment Variables**: Store configuration in .env files
- **Templates**: Use Nunjucks templates with .njk extension
- **CSS**: Use CSS in the templates/styles directory with CSS variables
- **Native APIs**: Prefer Bun's native APIs (e.g., Glob, File) when available
- **Date Format**: Use timezone-aware ISO format with PST/PDT timezone in all Markdown files: `date: YYYY-MM-DDT09:00:00-07:00` (displays as "Month Day, Year @ H AM/PM")

## Tag System

Tags and their descriptions are defined in `src/tags.toml` and displayed on tag pages. All available tags are listed in the TOML file with their descriptions.

### Tag Usage Guidelines

When adding tags to new content:

1. Use lowercase for all tags
2. Prioritize existing tags over creating new ones
3. Limit to 3-5 tags per article
4. Avoid creating new tags for single articles

### Tag Consolidation Recommendations

The following tags should be consolidated to maintain a consistent taxonomy:

- Use **technology** instead of **tech** or **tech trend**
- Use **ai** as the primary AI tag, with more specific AI tags when needed (**ai tool**, **large language model**, **ai assistant**)
- Use **web development** instead of **static site generator**
- Use **software engineering** for broad engineering topics, with more specific tags when relevant (**build tool**, **developer tool**)
- Use **privacy** to cover **web security**, **ad blocking**
- Use **cryptocurrency** instead of **bitcoin**
- Use **finance** to cover **fintech**
- Use **personal** to cover **learning**, **philosophy**

### Adding or Modifying Tags

To add or modify tag descriptions:

1. Edit `src/tags.toml`
2. Follow the existing TOML format: `"tag name" = "Your description here"`
3. The generator will automatically use these descriptions on tag pages

## Image Management Workflow

Images are stored in Cloudflare R2 (not in Git) to keep the repository size small and load times fast.

### Image Directory Structure

```
images/                  # Main images directory
└── example.com/         # Domain-specific images
    ├── header.jpg
    ├── profile.png
    └── logo.svg
```

### Image Configuration

1. Create a `.env` file with R2 credentials (see `.env.example`)
2. Required environment variables:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_PUBLIC_URL`

### Image Upload Methods

There are three ways to upload images:

1. Upload all images in a domain directory:

   ```bash
   bun run upload-images
   ```

2. Upload a single image using the CLI:

   ```bash
   bun run upload-image path/to/image.jpg
   ```

3. Quick upload with the shell script:
   ```bash
   ./upload-image.sh path/to/image.jpg
   ```

The image uploader supports JPG, PNG, GIF, WebP, and SVG formats. After uploading, it will provide you with the markdown syntax to use the image in your content.
