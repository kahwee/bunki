# Changelog

## 0.22.0 (unreleased candidate)

- Require Bun 1.4.4 or newer. Plain CSS now uses Bun’s native bundler by default; existing PostCSS configurations remain supported. Review generated CSS and asset URLs or select `css.processor: "postcss"`.
- Repair the package import mapping to the shipped `dist/index.js`; the 0.21.1 archive did not contain the mapped `dist/index.mjs`. Public API additions are additive. See the [migration guide](docs/migration.md).

- Run independent publishing preflight type checks and coverage tests in parallel, while keeping artifact generation and publication behind both checks.
- Clarify the aggregate local verification command and the tag-only publishing trigger in the contributor guidance.

- Remove obsolete tracked `temp-cli-init` fixtures left behind before init tests moved to `os.tmpdir`, ignore leftover in-repo test temp dirs, and keep the incremental cache regression fixtures off the worktree.
- Host existing artifact-build tools under Bun; preserve emitted package formats and declarations. Record three-run build benchmarks and identical-output fingerprints.
- Refresh compatible dependencies, including available toolchain security patches.

- Reuse tag slugs within each site model instead of repeating normalization for every post; keep the cache scoped to one build.
- Include runtime details and final HTML fingerprints in the build benchmark; document Cloudflare Static Assets deployment and Bun/Workers runtime boundaries.

- Patch sanitize-html to 2.18.1 to resolve GHSA-c9rx-x947-fp3h; the dependency audit reports no vulnerabilities.

- Bundle plain CSS with Bun in-process, including local imports and referenced assets; preserve PostCSS configuration auto-detection and explicit engine selection for plugin-based sites.
- Remove unused Tailwind/Autoprefixer development dependencies and stale configuration files, plus the redundant optional PostCSS peer declaration. Keep PostCSS runtime dependencies for existing sites.

- Run the PostCSS CLI with Bun to avoid starting Node for each CSS build.

- Simplify Actions caching around the committed text lockfile; remove the binary-lockfile fallback and shell hashing step.

- Run independent source checks in parallel with Bun; keep build and package validation after successful checks.
- Avoid repeating semantic type checks during declaration emission; standalone builds still run Bun checking first.

- Use Bun 1.4.4 for formatting and type checking; remove Biome. Keep TypeScript for declaration output.
- Pin GitHub Actions to verified stable release commits and use `bun ci` for frozen installs.

## 0.21.2 (unreleased)

- Update Marked to 18.1.2, PostCSS to 8.5.32, and sanitize-html to 2.18.1.
- Retain the existing YAML compatibility overrides. The previously deferred [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) was withdrawn upstream on October 22, 2026; the current dependency audit reports no advisories.
