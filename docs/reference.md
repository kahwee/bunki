# Bunki reference

Start with the [README](../README.md) for installation and examples. Run commands from your site root; `bunx bunki <command> --help` lists the available flags.

## Paths and configuration

The defaults are `bunki.config.ts`, `content/`, `templates/`, and `dist/`. Put files you want copied as-is in `public/`; template assets in `templates/assets/` are copied to `dist/assets/`. Both support dotfiles and extensionless files. Public files are copied last and take precedence at matching output paths.

`generate` accepts `--config`, `--content`, `--templates`, and `--output`. A `templatesDir` value in the loaded configuration takes precedence over the command's template path. To change the generation content path, use `--content`; `config.contentDir` is used by `validate`, not by `generate`.

The config loader accepts `.ts`, `.js`, `.mjs`, `.cjs`, and `.json` files inside the project root. A JavaScript or TypeScript module may export an object or a function returning one, including an async function. `defineConfig` preserves type inference; it does not validate configuration at runtime. Missing files and module-loading errors fall back to defaults, with errors logged for failed imports. Defaults are shallow, so supply all required fields when setting nested options such as `css`.

See [SiteConfig](../src/types.ts) and the [loader](../src/config.ts) for the full contract.

## Content and validation

`title` and `date` are required. Use a timezone-aware ISO date, quote titles containing colons, and use tag slugs without spaces. `excerpt` overrides the generated summary. `seoTitle` provides an optional shorter title for templates that use it.

Post URLs use the filename slug and the date's year in `America/Los_Angeles`. For `README.md` posts, the enclosing directory supplies the slug. Do not create both `my-post.md` and `my-post/README.md` under the same parent.

`business` accepts an object or array. Use a supported place type, `name`, `lat`, and `lng`; include `address` for complete location metadata. The parser validates each array entry but currently stores the first business on the rendered post. Deprecated location fields and tags containing spaces fail generation even without strict mode.

| Check | Behavior |
| --- | --- |
| `generate` | Reports parsing problems; skips malformed YAML and missing required fields unless strict mode is enabled |
| `strictMode: true` | Fails generation on any parsing error |
| `validate --dir content` | Parses in strict mode without generating a site |
| `validate:media --content-dir content` | Reports missing local references and unused media; exits unsuccessfully if either is found |

The media checker currently reads `content/{year}/*.md`, scans media in `content/{year}/_assets/` and `assets/`, and skips remote URLs. It is not a complete recursive audit of nested `README.md` posts or every HTML media embedding pattern. See the [implementation](../src/cli/commands/validate-media.ts) before relying on it for another layout.

## Template data

Required page templates are `index.njk`, `post.njk`, `tags.njk`, `tag.njk`, and `archive.njk`. Optional templates are `404.njk`, `map.njk`, and `privacy.njk`. `base.njk` is the layout used by the starter templates.

| Value | Available in |
| --- | --- |
| `site` | All page templates; the resolved site configuration |
| `post` | `post.njk`; parsed content, rendered HTML, URL, tags, and derived metadata |
| `posts` | Index and archive pages (paginated), and the map page (all posts) |
| `tag` | `tag.njk`; tag metadata and the current page's posts |
| `tags` | Index, tag, tag-index, and archive pages |
| `pagination` | Index, tag, and archive pages |
| `year` | Archive pages |
| `jsonLd` | Post and collection pages; structured data to include in your template |

Nunjucks escapes values by default. Use `{{ post.html | safe }}` for the HTML produced by Bunki's Markdown sanitization. JSON-LD must also be included by the template; generating the data does not inject it into arbitrary custom HTML.

Built-in [fragments](../src/fragments) provide social image tags, structured data, share buttons, and pagination. Local templates override fragments of the same name. The template engine adds `date` and `titlecase` filters; see [their supported formats](../src/utils/template-engine.ts).

## Builds and caching

An incremental build reuses parsed posts with unchanged file metadata. It checks content hashes when modification times change, validates the complete collection, and sorts posts newest first. Changes to the selected config file or resolved configuration invalidate cached posts. Cache-format changes also trigger a rebuild.

HTML pages, feeds, and static assets are regenerated or copied on every build. Incremental mode does not mean only changed output files are written. Deleted posts are removed from the content cache and listings, but generation does not prune old output files. Use a fresh output directory for deployments that must exclude removed pages.

CSS is processed through PostCSS, with plain-file copying as the site generator's fallback. The standalone `css` command reports processing failures instead of applying that fallback. Unchanged CSS can be skipped in incremental mode; content and config changes invalidate it. The CSS cache does not track a complete dependency graph: use a full build after changing imported styles, PostCSS dependencies, or template utility classes. A fallback copy does not compile Tailwind directives.

`.bunki-cache.json` is disposable local state. Ignore it in Git. Delete that file to reset incremental parsing, or omit `--incremental` for a full parse. A full parse still does not clean the output directory.

## Media uploads

Uploads are explicit: `generate` never calls `images:push`. Use `BUNKI_DRY_RUN=true bunx bunki images:push` to inspect paths without uploading. The dry run uses placeholder public URLs, so it does not verify credentials or the final CDN URL.

`--min-year` and `--max-year` are inclusive directory-year filters. They do not compare file hashes or modification times with remote storage. Matching media is uploaded again on repeated runs.

`--content-assets` removes the configured asset-directory segment from storage keys. For example, `content/2026/_assets/photo.jpg` becomes `2026/photo.jpg`. Use public URLs in content when the files should be served from remote storage. Upload configuration and environment-variable examples are in the [upload setup](#upload-configuration).

## Make it yours

Bunki uses Nunjucks templates in `templates/`. The defaults include social metadata and JSON-LD. Site and author configuration, post excerpts, tags, and the first content image supply metadata.

Built-in fragments can be imported into your templates. A local file with the same name overrides the built-in fragment.

| Fragment | Macros |
| --- | --- |
| `og-image.njk` | `og_image(post, site)`, `twitter_image(post, site)` |
| `json-ld.njk` | `blog_posting_schema(post, site)`, `local_business_schema(post, site)` |
| `share-buttons.njk` | `share_buttons(post, site)` |
| `pagination.njk` | `pagination_nav(pagination)` |

```nunjucks
{% from "pagination.njk" import pagination_nav %}
{{ pagination_nav(pagination) }}
```

The share and pagination fragments use Tailwind utility classes. See the [example templates](../templates) for layout.

To enable CSS processing, add this to `defineConfig({...})`:

```typescript
css: {
  input: "templates/styles/main.css",
  output: "css/style.css",
  postcssConfig: "postcss.config.js",
  enabled: true,
},
```

CSS runs during generation, with a fallback if PostCSS is unavailable or fails. For a Tailwind setup, see this repo's [PostCSS config](../postcss.config.js) and [stylesheet](../templates/styles/main.css).

## Upload configuration

`images:push` uploads JPG, JPEG, PNG, GIF, WebP, SVG, MP4, WebM, and MOV files to S3-compatible storage. Uploads are separate from site generation.

Add this to `defineConfig({...})`, with credentials in your environment or an uncommitted `.env` file:

```typescript
s3: {
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  bucket: process.env.S3_BUCKET || "",
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  publicUrl: process.env.S3_PUBLIC_URL || "",
},
```

By default, media comes from `assets/`, preserving paths such as `2026/my-post/photo.jpg`.

```bash
# Preview without uploading
BUNKI_DRY_RUN=true bunx bunki images:push

# Upload one year and save the public URL mapping
bunx bunki images:push --min-year 2026 --max-year 2026 --output-json media-urls.json

# Upload from content/2026/_assets/ instead
bunx bunki images:push --content-assets
```

With `--content-assets`, `content/2026/_assets/photo.jpg` uses the storage key `2026/photo.jpg`. Set `contentAssets.assetsDir` or pass `--content-assets-dir` for another folder name; `contentAssets.s3` can specify a separate bucket. Use `--images` to override the source directory and `--domain` for bucket identification.

Reference uploaded media by its public URL:

```html
<video controls>
  <source src="https://cdn.example.com/2026/my-post/video.mp4" type="video/mp4">
</video>
```

For upload failures, check the configured source directory, supported file extensions, bucket, endpoint, and credential permissions.
