import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTemplateEngine } from "../../src/utils/template-engine";

test("bundled fragments are available and site templates take precedence", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bunki-fragments-"));
  try {
    const fallback = createTemplateEngine(dir);
    expect(
      fallback.renderString('{% from "og-image.njk" import og_image %}{{ og_image(null, site) }}', {
        site: { baseUrl: "https://example.com" },
      }),
    ).toContain("og:image");
    await Bun.write(path.join(dir, "og-image.njk"), "site-override");
    const override = createTemplateEngine(dir);
    expect(override.renderString('{% include "og-image.njk" %}', {})).toBe("site-override");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
