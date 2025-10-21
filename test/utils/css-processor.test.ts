import {
  expect,
  test,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test";
import {
  processCSS,
  getDefaultCSSConfig,
  validateCSSConfig,
} from "../../src/utils/css-processor";
import path from "path";
import fs from "fs";

const TEST_DIR = path.join(import.meta.dir, "css-test");
const OUTPUT_DIR = path.join(TEST_DIR, "output");

describe("CSS Processor Tests", () => {
  beforeAll(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

    // Create test CSS file
    await fs.promises.writeFile(
      path.join(TEST_DIR, "input.css"),
      `/* Test CSS */
body {
  margin: 0;
  padding: 0;
}

.test {
  color: red;
}`,
    );

    // Create test PostCSS config
    await fs.promises.writeFile(
      path.join(TEST_DIR, "postcss.config.js"),
      `module.exports = {
  plugins: []
};`,
    );
  });

  // Keep directory for integration tests; cleanup handled per test run
  afterAll(async () => {});

  beforeEach(async () => {
    // Clean output directory
    try {
      await fs.promises.rm(OUTPUT_DIR, { recursive: true });
      await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    } catch {}
  });

  test("should process CSS successfully", async () => {
    const cssConfig = {
      input: "input.css",
      output: "style.css",
      postcssConfig: "postcss.config.js",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    // Check if output file was created
    const outputPath = path.join(OUTPUT_DIR, "style.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);

    // Check if content was processed
    const outputContent = await fs.promises.readFile(outputPath, "utf-8");
    expect(outputContent).toInclude("body");
    expect(outputContent).toInclude("margin: 0");
  });

  test("should handle missing input file gracefully", async () => {
    const cssConfig = {
      input: "nonexistent.css",
      output: "style.css",
      postcssConfig: "postcss.config.js",
      enabled: true,
      watch: false,
    };

    await expect(
      processCSS({
        css: cssConfig,
        projectRoot: TEST_DIR,
        outputDir: OUTPUT_DIR,
        verbose: false,
      }),
    ).rejects.toThrow("CSS input file not found");
  });

  test("should work without PostCSS config", async () => {
    const cssConfig = {
      input: "input.css",
      output: "style.css",
      postcssConfig: "nonexistent.config.js",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "style.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);
  });

  test("should create output directory if it doesn't exist", async () => {
    const nestedOutputDir = path.join(OUTPUT_DIR, "nested", "deep");

    const cssConfig = {
      input: "input.css",
      output: "nested/deep/style.css",
      postcssConfig: "postcss.config.js",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "nested", "deep", "style.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);
  });

  test("should skip processing when disabled", async () => {
    const cssConfig = {
      input: "input.css",
      output: "style.css",
      postcssConfig: "postcss.config.js",
      enabled: false,
      watch: false,
    };

    // Should not throw and should not create output file
    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "style.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(false);
  });
});

describe("CSS Config Tests", () => {
  test("should provide default CSS config", () => {
    const config = getDefaultCSSConfig();

    expect(config.input).toBeDefined();
    expect(config.output).toBeDefined();
    expect(config.enabled).toBe(true);
    expect(typeof config.enabled).toBe("boolean");
  });

  test("should validate CSS config correctly", () => {
    const validConfig = {
      input: "templates/styles/main.css",
      output: "css/style.css",
      postcssConfig: "postcss.config.js",
      enabled: true,
      watch: false,
    };

    const errors = validateCSSConfig(validConfig);
    expect(errors.length).toBe(0);
  });

  test("should detect invalid CSS config", () => {
    const invalidConfig = {
      input: "",
      output: "",
      postcssConfig: "postcss.config.js",
      enabled: "true" as any,
      watch: false,
    };

    const errors = validateCSSConfig(invalidConfig);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("CSS input path is required");
    expect(errors).toContain("CSS output path is required");
    expect(errors).toContain("CSS enabled must be a boolean");
  });

  test("should handle partial config", () => {
    const partialConfig = {
      input: "main.css",
      output: "style.css",
      enabled: true,
    } as any;

    const errors = validateCSSConfig(partialConfig);
    expect(errors.length).toBe(0);
  });
});

describe("Error Handling Tests", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  });

  test("should handle empty CSS file", async () => {
    await fs.promises.writeFile(path.join(TEST_DIR, "empty.css"), "");

    const cssConfig = {
      input: "empty.css",
      output: "empty-output.css",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "empty-output.css");
    const content = await fs.promises.readFile(outputPath, "utf-8");
    expect(content).toBe("");
  });

  test("should handle CSS with special characters", async () => {
    const cssWithSpecialChars = `/* 特殊文字 - Special chars */
.class-name {
  content: "Quote \\"test\\"";
  background: url('data:image/svg+xml;utf8,<svg>...</svg>');
}`;

    await fs.promises.writeFile(
      path.join(TEST_DIR, "special.css"),
      cssWithSpecialChars,
    );

    const cssConfig = {
      input: "special.css",
      output: "special-output.css",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "special-output.css");
    const content = await fs.promises.readFile(outputPath, "utf-8");
    expect(content).toInclude("class-name");
  });

  test("should validate config with missing input", () => {
    const config = {
      input: "",
      output: "style.css",
      enabled: true,
    } as any;

    const errors = validateCSSConfig(config);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("CSS input path is required");
  });

  test("should validate config with missing output", () => {
    const config = {
      input: "main.css",
      output: "",
      enabled: true,
    } as any;

    const errors = validateCSSConfig(config);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("CSS output path is required");
  });

  test("should validate config with non-boolean enabled", () => {
    const config = {
      input: "main.css",
      output: "style.css",
      enabled: "yes",
    } as any;

    const errors = validateCSSConfig(config);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("CSS enabled must be a boolean");
  });
});

describe("Integration Tests", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    // Ensure cleanup of any leftover integration assets
    for (const f of [
      "tailwind.css",
      "main.css",
      "base.css",
      "components.css",
      "utilities.css",
      "postcss.config.cjs",
    ]) {
      try {
        await fs.promises.unlink(path.join(TEST_DIR, f));
      } catch {}
    }
  });
  test("should handle CSS processing in site generation context", async () => {
    // Test with Tailwind-like input
    const tailwindInput = `@tailwind base;
@tailwind components;
@tailwind utilities;

.custom-class {
  @apply font-bold text-blue-500;
}`;

    await fs.promises.writeFile(
      path.join(TEST_DIR, "tailwind.css"),
      tailwindInput,
    );

    const cssConfig = {
      input: "tailwind.css",
      output: "tailwind-output.css",
      enabled: true,
      watch: false,
    };

    // Should not fail even though @tailwind directives won't be processed without Tailwind
    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "tailwind-output.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);

    const content = await fs.promises.readFile(outputPath, "utf-8");
    expect(content).toInclude(".custom-class");
  });

  test("should handle multiple CSS files pattern", async () => {
    // Create multiple CSS files
    const cssFiles = [
      { name: "base.css", content: "/* Base styles */" },
      { name: "components.css", content: "/* Components */" },
      { name: "utilities.css", content: "/* Utilities */" },
    ];

    for (const file of cssFiles) {
      await fs.promises.writeFile(path.join(TEST_DIR, file.name), file.content);
    }

    // Create main CSS file that imports others
    const mainCSS = `@import "./base.css";
@import "./components.css";
@import "./utilities.css";

body {
  font-family: system-ui;
}`;

    await fs.promises.writeFile(path.join(TEST_DIR, "main.css"), mainCSS);

    const cssConfig = {
      input: "main.css",
      output: "bundled.css",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "bundled.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);

    const content = await fs.promises.readFile(outputPath, "utf-8");
    expect(content).toInclude("font-family: system-ui");
  });

  test("should handle deeply nested output paths", async () => {
    await fs.promises.writeFile(
      path.join(TEST_DIR, "input.css"),
      "body { margin: 0; }",
    );

    const cssConfig = {
      input: "input.css",
      output: "dist/assets/css/styles/main.css",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "dist/assets/css/styles/main.css");
    const outputExists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(outputExists).toBe(true);
  });

  test("should preserve CSS content during fallback copy", async () => {
    const originalContent = `/* Important styles */
:root {
  --primary: #0066cc;
  --secondary: #ff6600;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
}

.button {
  padding: 8px 16px;
  border-radius: 4px;
}`;

    await fs.promises.writeFile(
      path.join(TEST_DIR, "preserve.css"),
      originalContent,
    );

    const cssConfig = {
      input: "preserve.css",
      output: "preserve-output.css",
      postcssConfig: "nonexistent-config.js",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "preserve-output.css");
    const outputContent = await fs.promises.readFile(outputPath, "utf-8");
    expect(outputContent).toBe(originalContent);
  });
});

describe("CSS Processor - Critical Paths", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.promises.writeFile(
      path.join(TEST_DIR, "main.css"),
      `body { margin: 0; }`,
    );
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(OUTPUT_DIR, { recursive: true });
    } catch {}
  });

  test("should handle enabled=false without creating output", async () => {
    const cssConfig = {
      input: "main.css",
      output: "style.css",
      enabled: false,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "style.css");
    const exists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  test("should handle nested output directories", async () => {
    const cssConfig = {
      input: "main.css",
      output: "nested/deep/style.css",
      enabled: true,
      watch: false,
    };

    await processCSS({
      css: cssConfig,
      projectRoot: TEST_DIR,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });

    const outputPath = path.join(OUTPUT_DIR, "nested/deep/style.css");
    const exists = await fs.promises
      .access(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});
