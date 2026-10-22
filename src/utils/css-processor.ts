import fs from "node:fs";
import path from "node:path";
import { hash } from "bun";
import type { CSSConfig } from "../types";
import { ensureDir } from "./file-utils";

export interface CSSProcessorOptions {
  /** CSS configuration */
  css: CSSConfig;
  /** Project root directory */
  projectRoot: string;
  /** Output directory for the site */
  outputDir: string;
  /** Whether to run in verbose mode */
  verbose?: boolean;
  /** Enable content-based cache busting with hash */
  enableHashing?: boolean;
}

export interface CSSProcessResult {
  /** Output file path (may include hash if hashing enabled) */
  outputPath: string;
  /** Content hash (8-char base36) if hashing enabled */
  hash?: string;
}

/**
 * Process CSS with Bun, or PostCSS for projects with a plugin configuration
 * Throws on error - no fallback
 * Returns output path (with hash if hashing enabled)
 */
export async function processCSS(options: CSSProcessorOptions): Promise<CSSProcessResult> {
  const { css, projectRoot, outputDir, verbose = false, enableHashing = false } = options;

  if (!css.enabled) {
    if (verbose) {
      console.log("CSS processing is disabled");
    }
    return { outputPath: "" };
  }

  const inputPath = path.resolve(projectRoot, css.input);
  const tempOutputPath = path.resolve(outputDir, css.output);
  const postcssConfigPath = css.postcssConfig
    ? path.resolve(projectRoot, css.postcssConfig)
    : path.resolve(projectRoot, "postcss.config.js");

  const configNames = [
    ...["js", "cjs", "mjs", "ts", "cts", "mts"].map((ext) => `postcss.config.${ext}`),
    ".postcssrc",
    ...["json", "yaml", "yml", "js", "cjs", "mjs", "ts", "cts", "mts"].map(
      (ext) => `.postcssrc.${ext}`,
    ),
  ];
  const hasPostCSSConfig = configNames.some((name) => fs.existsSync(path.join(projectRoot, name)));
  const packageFile = Bun.file(path.join(projectRoot, "package.json"));
  const hasPackageConfig =
    (await packageFile.exists()) && Boolean((await packageFile.json()).postcss);

  // Preserve existing plugin configurations; plain CSS needs no subprocess.
  const usePostCSS =
    css.processor === "postcss" ||
    (css.processor !== "bun" &&
      (Boolean(css.postcssConfig) || hasPostCSSConfig || hasPackageConfig));

  // Validate input file exists
  const inputFile = Bun.file(inputPath);
  if (!(await inputFile.exists())) {
    throw new Error(`CSS input file not found: ${inputPath}`);
  }

  // Ensure output directory exists
  const outputDirPath = path.dirname(tempOutputPath);
  await ensureDir(outputDirPath);

  if (verbose) {
    console.log(`🎨 Building CSS with ${usePostCSS ? "PostCSS" : "Bun"}...`);
    console.log(`Input: ${inputPath}`);
    console.log(`Output: ${tempOutputPath}`);
    if (usePostCSS) console.log(`Config: ${postcssConfigPath}`);
  }

  if (usePostCSS) {
    await runPostCSS(inputPath, tempOutputPath, postcssConfigPath, projectRoot, verbose);
  } else {
    const result = await Bun.build({
      entrypoints: [inputPath],
      outdir: outputDirPath,
      target: "browser",
      naming: {
        entry: path.basename(tempOutputPath),
        asset: "[name]-[hash].[ext]",
      },
    });
    if (!result.success) {
      throw new Error(`Bun CSS build failed: ${result.logs.join("\n")}`);
    }
  }

  // Apply content hashing if enabled
  if (enableHashing) {
    const cssFile = Bun.file(tempOutputPath);
    const cssContent = await cssFile.arrayBuffer();

    // Generate hash using Bun's native hash function
    const contentHash = hash(cssContent).toString(36).slice(0, 8);

    // Create hashed filename: style.css -> style.abc123de.css
    const ext = path.extname(tempOutputPath);
    const basename = path.basename(tempOutputPath, ext);
    const dir = path.dirname(tempOutputPath);
    const hashedFilename = `${basename}.${contentHash}${ext}`;
    const hashedOutputPath = path.join(dir, hashedFilename);

    // Copy to hashed filename
    await Bun.write(hashedOutputPath, cssFile);

    if (verbose) {
      console.log(`✅ CSS hashed: ${hashedFilename}`);
    }

    return {
      outputPath: hashedOutputPath,
      hash: contentHash,
    };
  }

  return { outputPath: tempOutputPath };
}

/**
 * Run PostCSS process
 * Throws on error - config issues will be caught
 */
async function runPostCSS(
  inputPath: string,
  outputPath: string,
  configPath: string,
  projectRoot: string,
  verbose: boolean,
): Promise<void> {
  const subprocess = Bun.spawn(
    [
      process.execPath,
      "x",
      "--bun",
      "postcss",
      inputPath,
      "-o",
      outputPath,
      "--config",
      configPath,
    ],
    {
      cwd: projectRoot,
      stdin: "ignore",
      stdout: verbose ? "inherit" : "ignore",
      stderr: verbose ? "inherit" : "pipe",
    },
  );
  const [code, errorOutput] = await Promise.all([
    subprocess.exited,
    subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve(""),
  ]);
  if (code !== 0) {
    throw new Error(`PostCSS failed with exit code ${code}: ${errorOutput.trim()}`);
  }
  if (verbose) console.log("✅ CSS build completed successfully!");
}

/**
 * Watch CSS files for changes and reprocess
 */
export async function watchCSS(options: CSSProcessorOptions): Promise<void> {
  const { css, projectRoot, verbose = false } = options;

  if (!css.enabled || !css.watch) {
    return;
  }

  const inputPath = path.resolve(projectRoot, css.input);
  const watchDir = path.dirname(inputPath);

  if (verbose) {
    console.log(`👀 Watching CSS files in ${watchDir}...`);
  }

  // Note: This is a basic implementation. In a production system,
  // you might want to use a more sophisticated file watcher
  const watcher = fs.watch(watchDir, { recursive: true }, async (_eventType, filename) => {
    if (filename && (filename.endsWith(".css") || filename.endsWith(".pcss"))) {
      if (verbose) {
        console.log(`🔄 CSS file changed: ${filename}`);
      }
      try {
        await processCSS(options);
      } catch (error) {
        console.error("❌ CSS rebuild failed:", error);
      }
    }
  });

  // Return a promise that never resolves (keeps watching)
  return new Promise(() => {
    process.on("SIGINT", () => {
      watcher.close();
      process.exit(0);
    });
  });
}

/**
 * Get default CSS configuration
 */
export function getDefaultCSSConfig(): CSSConfig {
  return {
    input: "templates/styles/main.css",
    output: "css/style.css",
    enabled: true,
    watch: false,
  };
}

/**
 * Validate CSS configuration
 */
export function validateCSSConfig(css: CSSConfig): string[] {
  const errors: string[] = [];

  if (!css.input) {
    errors.push("CSS input path is required");
  }

  if (!css.output) {
    errors.push("CSS output path is required");
  }

  if (typeof css.enabled !== "boolean") {
    errors.push("CSS enabled must be a boolean");
  }

  return errors;
}
