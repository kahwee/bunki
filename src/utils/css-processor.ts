import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { CSSConfig } from "../types";

export interface CSSProcessorOptions {
  /** CSS configuration */
  css: CSSConfig;
  /** Project root directory */
  projectRoot: string;
  /** Output directory for the site */
  outputDir: string;
  /** Whether to run in verbose mode */
  verbose?: boolean;
}

/**
 * Process CSS using PostCSS directly
 * Throws on error - no fallback
 */
export async function processCSS(options: CSSProcessorOptions): Promise<void> {
  const { css, projectRoot, outputDir, verbose = false } = options;

  if (!css.enabled) {
    if (verbose) {
      console.log("CSS processing is disabled");
    }
    return;
  }

  const inputPath = path.resolve(projectRoot, css.input);
  const outputPath = path.resolve(outputDir, css.output);
  const postcssConfigPath = css.postcssConfig
    ? path.resolve(projectRoot, css.postcssConfig)
    : path.resolve(projectRoot, "postcss.config.js");

  // Validate input file exists
  try {
    await fs.promises.access(inputPath);
  } catch (error) {
    throw new Error(`CSS input file not found: ${inputPath}`);
  }

  // Ensure output directory exists
  const outputDirPath = path.dirname(outputPath);
  await fs.promises.mkdir(outputDirPath, { recursive: true });

  if (verbose) {
    console.log("🎨 Building CSS with PostCSS...");
    console.log(`Input: ${inputPath}`);
    console.log(`Output: ${outputPath}`);
    console.log(`Config: ${postcssConfigPath}`);
  }

  await runPostCSS(
    inputPath,
    outputPath,
    postcssConfigPath,
    projectRoot,
    verbose,
  );
}

/**
 * Run PostCSS process
 * Throws on error - config issues will be caught
 */
function runPostCSS(
  inputPath: string,
  outputPath: string,
  configPath: string,
  projectRoot: string,
  verbose: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "postcss",
      inputPath,
      "-o",
      outputPath,
      "--config",
      configPath,
    ];

    const postcss = spawn("bunx", args, {
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
      cwd: projectRoot,
    });

    let errorOutput = "";
    if (!verbose) {
      postcss.stderr?.on("data", (data) => {
        errorOutput += data.toString();
      });
    }

    postcss.on("close", (code) => {
      if (code === 0) {
        if (verbose) console.log("✅ CSS build completed successfully!");
        return resolve();
      }

      reject(
        new Error(
          `PostCSS failed with exit code ${code}: ${errorOutput.trim()}`,
        ),
      );
    });

    postcss.on("error", (err) => {
      reject(new Error(`Failed to start PostCSS: ${err.message}`));
    });
  });
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
  const watcher = fs.watch(
    watchDir,
    { recursive: true },
    async (eventType, filename) => {
      if (
        filename &&
        (filename.endsWith(".css") || filename.endsWith(".pcss"))
      ) {
        if (verbose) {
          console.log(`🔄 CSS file changed: ${filename}`);
        }
        try {
          await processCSS(options);
        } catch (error) {
          console.error("❌ CSS rebuild failed:", error);
        }
      }
    },
  );

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
    postcssConfig: "postcss.config.js",
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
