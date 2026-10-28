# Migrating to 0.22.0 (release candidate)

Compared with npm 0.21.1, Bunki now requires Bun 1.4.4 or newer (previously 1.3.14). Upgrade Bun before installing.

Plain CSS now defaults to Bun’s native bundler. Review generated CSS and asset URLs after upgrading: local imports are bundled and assets may be embedded. To retain the PostCSS engine, set `css.processor: "postcss"` in your configuration. Existing PostCSS plugin configurations remain supported and are detected automatically; see the [CSS reference](https://github.com/kahwee/bunki/blob/main/docs/reference.md#css-configuration).

The root import now maps to the shipped `dist/index.js`. The 0.21.1 npm manifest mapped imports to `dist/index.mjs`, but that file was absent from its archive. Public API additions are additive.

This is a candidate, not a published release.
