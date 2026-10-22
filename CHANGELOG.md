# Changelog

## Unreleased

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

- Update Marked to 18.1.1, PostCSS to 8.5.30, and sanitize-html to 2.18.1.
- Retain the existing YAML compatibility overrides. The transitive [sprintf-js moderate denial-of-service advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) has no patched npm release and remains deferred.
