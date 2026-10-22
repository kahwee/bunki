# Cloudflare Workers and Bun

Bun is the build runtime for Bunki. Cloudflare Workers can serve its generated site
through [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
A Bunki site does not need a Worker script just to serve HTML, CSS, feeds, and images.

## Compatibility

Use Bun for installing packages, formatting, type checking, tests, and static site
generation. Pin the build environment to the version in `.bun-version`; this
repository currently uses Bun 1.4.4. On Workers Builds, set `BUN_VERSION=1.4.4`
explicitly so the build does not depend on Cloudflare's default version.
See [build image version overrides](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#overriding-default-versions).

[Workers runs on V8 isolates](https://developers.cloudflare.com/workers/reference/how-workers-works/).
It does not execute the Bun runtime. `Bun.file`, `Bun.write`, `Bun.build`, `Bun.serve`,
and Bun's subprocess APIs are build-time tools here. Do not import Bunki's generator
into a Worker request handler. The `nodejs_compat` flag supports documented Node.js
APIs; it does not add Bun APIs. Worker code should use Web APIs and Cloudflare
bindings, with [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
only when its dependencies require it.

Bun can install Wrangler and run deployment commands through `bunx`. This does not
change the deployed runtime or imply that Wrangler itself must execute under Bun.
Keep Wrangler pinned in the site project's lockfile.

Bun unit tests can cover portable application logic. Tests that depend on Worker
bindings or runtime behavior should run through Cloudflare's local runtime or
Workers testing tools; `bun test` alone does not emulate workerd.

## Deploy a generated site

In a site project with Bunki and Wrangler installed, generate into a dedicated
output directory. Remove old generated files before production builds so deleted
pages do not remain in the deployment. Keep source, configuration, and credentials
outside this directory.

```sh
bun ci
rm -rf public-site
bunx bunki generate --output public-site
bunx wrangler deploy
```

Create `wrangler.jsonc` in that site project:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-bunki-site",
  "compatibility_date": "2026-10-22",
  "assets": {
    "directory": "./public-site",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  }
}
```

This assets-only configuration needs no `main`, asset binding, or `nodejs_compat`
flag. `auto-trailing-slash` serves Bunki's `post/index.html` pages at `/post/`.
`404-page` serves the generated `404.html` with a 404 status; include a `404.njk`
template to generate it. Use static-site routing rather than an SPA fallback.
See [static site routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/).

For Workers Builds, use a site build script that cleans `public-site` and generates
the site, then deploy with Wrangler. This guide is a deployment recipe; this
repository does not provision a Cloudflare project or deploy your site automatically.

## Where the performance gains come from

Bun speeds up local and CI work. It does not make deployed Worker execution faster
by changing the runtime. Static Assets serves matching files without running Worker
code by default, so a static Bunki site can avoid application code on its request
path. Add a Worker only for features such as forms, APIs, or dynamic responses, and
keep ordinary static files on the asset path.

Cloudflare provides asset caching and ETags. Its default browser cache policy
revalidates content, which suits HTML and stable filenames such as `css/style.css`.
Use long-lived immutable browser caching only for URLs containing content hashes;
do not apply it indiscriminately to all CSS or HTML. Site `public/_headers` files
are copied into the output and can configure static response headers.
See [Static Assets headers](https://developers.cloudflare.com/workers/static-assets/headers/).
