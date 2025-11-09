# CLAUDE.md - Bunki Development Guidelines

## Environment Setup

Requires **Bun v1.3.2+** (recommended) or Node.js v18+

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
bun upgrade --version 1.3.2

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

**Prefer Bun Native APIs:**

Always use Bun's native implementations for best performance and consistency.

File Operations:

- `Bun.file(path)` - Create BunFile reference
- `await file.exists()` - Check file existence (files only, not directories)
- `await file.stat()` - Get file metadata (size, mtime, isFile(), isDirectory())
- `await file.text()` - Read as text (zero-copy)
- `await file.arrayBuffer()` - Read as binary (zero-copy)
- `await file.unlink()` - Delete file
- `file.writer()` - Create buffered writer for streaming
- `Bun.write(target, data)` - Write files (zero-copy file-to-file)
- `Bun.write(Bun.stdout, file)` - Stream to stdout (zero-copy, like `cat`)

Path Operations:

- `Glob` from "bun" - Native glob pattern matching with multiple modes:
  - Recursive scanning: `for await (const file of glob.scan("."))`
  - Pattern matching: `glob.match(filepath)` returns boolean
  - Supports `**/*.ts`, `*.{ts,tsx}`, `???.ts` patterns
  - Includes single char (`?`) and star (`*`) wildcards
  - No external dependencies, built-in to Bun

Servers & I/O:

- `Bun.serve()` - HTTP server (use instead of express, fastify for Bun)
- `fetch()` - Native fetch API (built-in, no library needed)
- `Bun.stdin`, `Bun.stdout`, `Bun.stderr` - Standard streams

Fall back to Node.js APIs only when Bun doesn't provide an equivalent:

- `mkdir()` from `node:fs/promises` - For recursive directory creation (Bun doesn't provide this)
  - Use: `import { mkdir } from "node:fs/promises"`
  - Call: `await mkdir("path", { recursive: true })` (like `mkdir -p`)

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

## Bun Native APIs & Performance

### Zero-Copy File Operations

Bun's native file APIs use zero-copy at the kernel level for maximum performance:

**File-to-File Copy (like `cat`):**

```typescript
// ✅ Optimal: kernel-level zero-copy
await Bun.write("./copy.bin", Bun.file("./source.bin"));

// ❌ Avoid: loads entire file into memory
const data = await Bun.file("./source.bin").arrayBuffer();
await Bun.write("./copy.bin", data);
```

**Streaming to stdout:**

```typescript
// ✅ Optimal: zero-copy stream to stdout
await Bun.write(Bun.stdout, Bun.file("./large-file.txt"));

// ❌ Avoid: reads entire file into memory
const content = await Bun.file("./large-file.txt").text();
console.log(content);
```

**Buffered Incremental Writes:**

```typescript
// ✅ Optimal: buffered writing with 1MB watermark
const writer = Bun.file("./output.txt").writer({ highWaterMark: 1024 * 1024 });
writer.write("chunk 1\n");
writer.write("chunk 2\n");
await writer.flush();
await writer.end();
```

### Pattern Matching with Glob

Use Bun's native `Glob` for efficient path matching without external dependencies:

**Recursive Directory Scan:**

```typescript
import { Glob } from "bun";

// Find all TypeScript files recursively
const glob = new Glob("**/*.ts");
for await (const file of glob.scan(".")) {
  console.log(file); // Full paths
}
```

**Pattern Matching (no file system access):**

```typescript
import { Glob } from "bun";

// Test if a path matches a pattern
const g = new Glob("**/*.{ts,tsx}");
g.match("src/index.tsx"); // true
g.match("src/style.css"); // false

// Single character and star wildcards
new Glob("???.ts").match("foo.ts"); // true (? = single char)
new Glob("*.ts").match("index.ts"); // true (* = any chars)
```

### File I/O Module (src/utils/file-utils.ts)

All file operations use Bun native APIs for consistency and performance:

**Check File Existence (files only):**

```typescript
const file = Bun.file("./package.json");
const exists = await file.exists(); // boolean (doesn't check directories)
```

**Get File Metadata:**

```typescript
const stat = await Bun.file("./file.txt").stat();
if (stat?.isFile()) {
  /* is a file */
}
if (stat?.isDirectory()) {
  /* is a directory */
}
const size = stat?.size; // bytes
const mtime = stat?.mtime; // Date object
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
