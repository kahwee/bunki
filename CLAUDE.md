# CLAUDE.md - Bunki Development Guidelines

## Environment Setup

Requires **Bun v1.3.0+** (recommended) or Node.js v18+

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
bun upgrade --version 1.3.0

# Clone and setup
git clone git@github.com:kahwee/bunki.git
cd bunki
bun install
```

## Development Commands

```bash
bun run build             # Build distribution
bun run dev               # Development mode with watch
bun test                  # Run test suite
bun test:coverage         # Coverage report
bun run typecheck         # TypeScript validation
bun run format            # Prettier formatting
bun run format:check      # Check formatting without changes
bun run clean             # Remove build artifacts
```

## Code Style

**TypeScript:**

- Strict mode enabled
- Explicit type annotations
- Interfaces over type aliases for object shapes
- PascalCase for types/interfaces
- camelCase for variables/functions

**Files & Formatting:**

- kebab-case for filenames
- 2-space indentation
- Semicolons required
- ES modules with explicit named imports

**Templates & Styles:**

- Nunjucks (.njk) for templates
- CSS with variables in templates/styles/
- HTML sanitization for all user content

**Dates:**

- ISO 8601 format: `2025-01-15T09:00:00-07:00`
- Include timezone offset for consistency

**Prefer Bun APIs:**

- Bun.file() for file operations
- Bun.glob() for path matching
- Bun.serve() for HTTP servers
- Native fetch() instead of external libraries

## Testing

Tests use Bun's native test framework with Jest-compatible assertions.

**Conventions:**

- Location: `test/` directory mirroring `src/` structure
- Naming: `.test.ts` suffix (e.g., `utils/markdown-utils.test.ts`)
- Function: Use `test()` from `bun:test`, NOT `it()`
- Pattern: "should..." with present tense
- Organization: Group in `describe()` blocks

**Example:**

```typescript
import { describe, test, expect } from "bun:test";

describe("Markdown Utils", () => {
  test("should extract excerpt from content", () => {
    const result = extractExcerpt("Hello world", 5);
    expect(result).toBe("Hello...");
  });

  test("should sanitize HTML", () => {
    const html = convertMarkdownToHtml('<img onerror="alert()">');
    expect(html).not.toInclude("onerror");
  });
});
```

**Run Tests:**

```bash
bun test                           # All tests
bun test:coverage                  # With coverage
bun test test/utils/parser.test.ts # Specific file
```

## Project Structure

```
bunki/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── config.ts           # Configuration loading
│   ├── site-generator.ts   # Core generation logic
│   ├── server.ts           # Development HTTP server
│   ├── parser.ts           # Markdown + YAML parsing
│   ├── types.ts            # TypeScript type definitions
│   └── utils/              # Utility modules
│       ├── css-processor.ts    # PostCSS integration
│       ├── file-utils.ts       # File I/O operations
│       ├── markdown-utils.ts   # HTML/markdown processing
│       ├── image-uploader.ts   # Cloud image uploads
│       └── s3-uploader.ts      # S3/R2 API client
├── test/                   # Test suite (mirrors src/)
│   ├── cli/
│   │   └── commands/
│   ├── utils/
│   ├── security/
│   ├── *.test.ts
│   └── fixtures/
├── templates/              # Example templates
├── fixtures/               # Test fixtures
└── dist/                   # Built output
```

## Key Concepts

**CLI Structure:**

- Single entry point: `src/cli.ts`
- Command implementations: `src/cli/commands/`
- Dependency injection for testing
- Bun.main for entry point detection

**Markdown Processing:**

- YAML frontmatter parsing (title, date, tags, excerpt)
- HTML sanitization via DOMPurify
- Syntax highlighting via highlight.js
- XSS protection on external links
- YouTube link to embed conversion

**CSS Processing:**

- Optional PostCSS pipeline
- Fallback to direct file copy if PostCSS fails
- Output to configurable dist path
- Watch mode support for development

**Image Uploads:**

- S3/R2 compatible storage (not Git)
- Bun's native S3 API integration
- Support for JPG, PNG, GIF, WebP, SVG
- Optional domain-specific CDN routing

## Important Fixes

**CLI Entry Detection:**
File path comparison for Bun.main requires URL protocol normalization:

```typescript
// src/cli.ts - handles file:// prefix difference
const isMainModule =
  import.meta.url === Bun.main ||
  import.meta.url === `file://${Bun.main}` ||
  Bun.main.endsWith(import.meta.path);
```

**Config Initialization:**
The config path must be passed to validation:

```typescript
// src/config.ts
const configPath = resolve(cwd, configFile);
configExists(configPath); // must pass configPath parameter
```

## Common Tasks

**Add New Utility Function:**

1. Create in `src/utils/module-name.ts`
2. Add tests in `test/utils/module-name.test.ts`
3. Export from `src/types.ts` if part of public API
4. Update tests to mirror new structure

**Fix Security Issue:**

1. Add test case in `test/security/` demonstrating vulnerability
2. Fix in corresponding `src/` module
3. Verify test passes and no regressions
4. Document in commit message

**Add CLI Command:**

1. Create handler in `src/cli/commands/`
2. Add dependency injection parameters
3. Export from `src/cli.ts`
4. Add tests in `test/cli/commands/`
5. Update CLI help text

**Improve Test Coverage:**

- Focus on edge cases and error paths
- Test both happy path and error conditions
- Use fixtures for complex test data
- Avoid testing external dependencies (mock if needed)
- Aim for 80%+ line coverage on utils
