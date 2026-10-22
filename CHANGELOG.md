# Changelog

## Unreleased

- Use Bun 1.4.4 for formatting and type checking; remove Biome. Keep TypeScript for declaration output.
- Pin GitHub Actions to verified stable release commits and use `bun ci` for frozen installs.

## 0.21.2 (unreleased)

- Update Marked to 18.1.1, PostCSS to 8.5.30, and sanitize-html to 2.18.0.
- Retain the existing YAML compatibility overrides. The transitive [sprintf-js moderate denial-of-service advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) has no patched npm release and remains deferred.
