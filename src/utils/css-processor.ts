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
 * Process CSS using PostCSS
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

  let postcssConfigExists = false;
  try {
    await fs.promises.access(postcssConfigPath);
    postcssConfigExists = true;
  } catch (error) {
    if (verbose) {
      console.log(
        `PostCSS config not found at ${postcssConfigPath}, will fallback to simple copy`,
      );
    }
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

  // If no config file, just perform a simple copy (identity transform)
  if (!postcssConfigExists) {
    await fs.promises.copyFile(inputPath, outputPath);
    if (verbose) console.log("Copied CSS without PostCSS config");
    return;
  }

  const runPostCSS = (configPathToUse: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const args = ["postcss", inputPath, "-o", outputPath];
      if (configPathToUse && fs.existsSync(configPathToUse)) {
        args.push("--config", configPathToUse);
      }

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

      postcss.on("close", async (code) => {
        if (code === 0) {
          if (verbose) console.log("✅ CSS build completed successfully!");
          return resolve();
        }

        // Detect CommonJS config under ESM error and attempt .cjs conversion once
        if (
          /module is not defined in ES module scope/i.test(errorOutput) &&
          configPathToUse.endsWith(".js")
        ) {
          const cjsPath = configPathToUse.replace(/\.js$/, ".cjs");
          try {
            if (!fs.existsSync(cjsPath)) {
              const original = await fs.promises.readFile(
                configPathToUse,
                "utf-8",
              );
              await fs.promises.writeFile(cjsPath, original, "utf-8");
              if (verbose) {
                console.log(
                  `Retrying PostCSS with converted CommonJS config at ${cjsPath}`,
                );
              }
            }
            return resolve(runPostCSS(cjsPath));
          } catch (e) {
            if (verbose) console.warn("CJS fallback failed, copying CSS.");
            await fs.promises.copyFile(inputPath, outputPath);
            return resolve();
          }
        }

        // Final fallback: copy input to output so build proceeds
        if (verbose) {
          console.warn(
            `PostCSS failed (code ${code}). Falling back to simple copy. Error: ${errorOutput.trim()}`,
          );
        }
        try {
          await fs.promises.copyFile(inputPath, outputPath);
          resolve();
        } catch (copyErr: any) {
          reject(
            new Error(
              `CSS build failed with code ${code} and fallback copy also failed: ${copyErr.message}`,
            ),
          );
        }
      });

      postcss.on("error", (err) => {
        // On spawn error, fallback to copy
        if (verbose) {
          console.warn(
            `Failed to start PostCSS process (${err.message}). Falling back to copy.`,
          );
        }
        fs.promises
          .copyFile(inputPath, outputPath)
          .then(() => resolve())
          .catch((copyErr) =>
            reject(
              new Error(
                `Failed to start PostCSS and fallback copy failed: ${copyErr.message}`,
              ),
            ),
          );
      });
    });
  };

  await runPostCSS(postcssConfigPath);
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
