# CLAUDE.md - Bunki Development Guidelines

## Environment Setup

Bunki requires **Bun v1.3.14+**. Bun is the supported runtime for installing, building, testing, and running this repo.

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
bun upgrade --version 1.3.14

# Clone and set up
cd bunki
bun install
```

## Development Commands

Use the scripts defined in `package.json`:

```bash
bun run build          # Build distribution
bun run dev            # Development mode with watch
bun test               # Run test suite
bun test:coverage      # Coverage report
bun test:watch         # Watch mode for tests
bun run typecheck      # TypeScript validation
bun run format         # Biome formatting
bun run format:check   # Check formatting without changes
bun run lint           # Biome lint and format checks
bun run lint:fix       # Write Biome fixes
bun run clean          # Remove build artifacts
```

CLI commands currently registered by `src/cli.ts`:

- `bunki init [--config FILE]`
- `bunki new <title> [--tags a,b]`
- `bunki generate [--config FILE] [--content DIR] [--output DIR] [--templates DIR] [--incremental]`
- `bunki serve [--output DIR] [--port 3000]`
- `bunki css [--config FILE] [--output DIR] [--watch]`
- `bunki images:push [--domain DOMAIN] [--images DIR] [--output-json FILE] [--min-year YEAR] [--max-year YEAR] [--content-assets] [--content-assets-dir DIR]`
- `bunki validate [--config FILE] [--dir DIR]`
- `bunki validate:media [--content-dir DIR]`

## Code Style

**TypeScript**

- Strict mode enabled
- Explicit type annotations where helpful
- Interfaces over type aliases for object shapes
- PascalCase for types and interfaces
- camelCase for variables and functions

**Files & Formatting**

- kebab-case filenames
- 2-space indentation
- Semicolons required
- ES modules with named imports

**Templates & Content**

- Nunjucks (`.njk`) for templates
- CSS lives in `templates/styles/`
- HTML sanitization for all user content
- ISO 8601 dates with timezone offsets, e.g. `2025-01-15T09:00:00-07:00`

**Prefer Bun native APIs**

Use Bun's built-ins first, and only fall back to Node.js APIs when Bun does not provide an equivalent.

- `Bun.file(path)` / `await file.text()` / `await file.arrayBuffer()` / `await file.stat()` / `await file.exists()`
- `Bun.write(target, data)` for file output and zero-copy file-to-file copies
- `Bun.stdout` / `Bun.stdin` / `Bun.stderr` for stream handling
- `Glob` from `bun` for file scanning and pattern matching
- `Bun.serve()` for HTTP servers
- `mkdir()` from `node:fs/promises` only when recursive directory creation is needed

## Testing

Bunki uses Bun's native test runner with Jest-compatible assertions.

**Conventions**

- Tests live in `test/` and mirror `src/`
- Use `.test.ts` suffix
- Use `test()` from `bun:test`, not `it()`
- Name tests with the pattern `should ...`
- Group related cases in `describe()` blocks

**Run tests**

```bash
bun test
bun test:coverage
bun test test/utils/parser.test.ts
```

## Project Structure

```text
bunki/
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── site-generator.ts
│   ├── server.ts
│   ├── parser.ts
│   ├── types.ts
│   ├── cli/commands/
│   ├── generators/
│   └── utils/
├── test/
├── templates/
├── fixtures/
├── content/
└── public/
```

## Source-of-truth notes

Read the implementation before updating docs or behavior:

- `src/cli.ts` owns command registration
- `src/cli/commands/` holds command handlers
- `src/config.ts` defines config defaults and loading
- `src/parser.ts` and `src/utils/markdown/` define markdown/frontmatter behavior
- `src/generators/` owns site output generation
- `src/utils/image-uploader.ts` and `src/utils/s3-uploader.ts` own media upload behavior

## Bun Native APIs & Performance

### Zero-copy file operations

```typescript
await Bun.write("./copy.bin", Bun.file("./source.bin"));
await Bun.write(Bun.stdout, Bun.file("./large-file.txt"));
```

Avoid reading large files into memory unless you need the contents.

### Pattern matching with Glob

```typescript
import { Glob } from "bun";

const glob = new Glob("**/*.ts");
for await (const file of glob.scan(".")) {
  console.log(file);
}
```

### File I/O module

Use Bun file helpers for existence checks, metadata, text reads, and binary reads. Prefer `Bun.write()` for writes and copies.

## Implementation patterns to preserve

- Use `Promise.all()` for independent work
- Batch large post collections instead of processing one-by-one
- Precompile regex patterns at module load time
- Use `Set` for validation lookups instead of repeated array scans
- Use `Bun.hash()` for content-based cache busting

## Key concepts

**CLI**

- Single entry point: `src/cli.ts`
- Dependency injection is used to keep command handlers testable
- `bunki new` slugifies the title, writes an ISO date, and creates a markdown stub in `content/`

**Markdown processing**

- Frontmatter includes `title`, `date`, `tags`, and optional `excerpt`
- Tags must be hyphenated slugs, not words with spaces
- Relative markdown links are converted to site URLs during build
- HTML is sanitized before output
- Syntax highlighting is handled with `highlight.js`

**CSS**

- PostCSS is optional
- If PostCSS is unavailable or fails, the pipeline should still produce usable output
- Cache busting should be content-based, not time-based

**Images**

- S3/R2-compatible storage is used for uploads
- Support JPG, JPEG, PNG, GIF, and WebP for uploads; videos are supported separately
- Keep public uploads and local site generation separate

## Important fixes

**CLI entry detection**

`src/cli.ts` compares the current file with `Bun.main` and normalizes the `file://` prefix:

```typescript
const currentFile = import.meta.url.replace("file://", "");
const mainFile = Bun.main;
if (currentFile === mainFile || currentFile.endsWith(mainFile)) {
  program.parse(Bun.argv);
}
```

**Config path handling**

Resolve the config path before checking or loading it:

```typescript
const configPath = path.resolve(options.config);
const configCreated = await createDefaultConfig(configPath);
```

## Common tasks

**Add a new utility function**

1. Create the utility in `src/utils/`
2. Add tests in `test/utils/`
3. Export from `src/index.ts` if it is public API
4. Update docs if the function is user-facing

**Add a CLI command**

1. Create the handler in `src/cli/commands/`
2. Register it in `src/cli.ts`
3. Keep side effects behind dependency injection
4. Add tests in `test/cli/commands/`

**Fix a regression**

1. Add a failing test first
2. Fix the implementation in the matching source module
3. Re-run the smallest relevant test set
4. Expand to broader tests if the change is cross-cutting

**Improve test coverage**

- Focus on edge cases and error paths
- Test both success and failure cases
- Use fixtures for complex inputs
- Avoid relying on live external services unless the test is explicitly an integration smoke test
