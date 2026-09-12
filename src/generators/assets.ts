/**
 * Asset generation - CSS and static file copying
 */

import path from "node:path";
import { Glob } from "bun";
import type { CSSConfig, SiteConfig } from "../types";
import { mapConcurrent } from "../utils/concurrency";
import { getDefaultCSSConfig, processCSS } from "../utils/css-processor";
import { copyFile, ensureDir, isDirectory } from "../utils/file-utils";

/**
 * Generate stylesheet using PostCSS or fallback to direct copy
 * @param config - Site configuration
 * @param outputDir - Output directory
 */
export async function generateStylesheet(
  config: SiteConfig,
  outputDir: string,
  projectRoot = process.cwd(),
): Promise<void> {
  // Use CSS configuration from site config, or fallback to default
  const cssConfig = config.css || getDefaultCSSConfig();

  if (!cssConfig.enabled) {
    console.log("CSS processing is disabled, skipping stylesheet generation.");
    return;
  }

  try {
    await processCSS({
      css: cssConfig,
      projectRoot,
      outputDir,
      verbose: true,
    });
  } catch (error) {
    console.error("Error processing CSS:", error);

    // Fallback to simple file copying if PostCSS fails
    console.log("Falling back to simple CSS file copying...");
    await fallbackCSSGeneration(cssConfig, outputDir, projectRoot);
  }
}

/**
 * Fallback CSS generation - direct file copy without processing
 * @param cssConfig - CSS configuration
 * @param outputDir - Output directory
 */
async function fallbackCSSGeneration(
  cssConfig: CSSConfig,
  outputDir: string,
  projectRoot: string,
): Promise<void> {
  const cssFilePath = path.resolve(projectRoot, cssConfig.input);
  const cssFile = Bun.file(cssFilePath);

  if (!(await cssFile.exists())) {
    console.warn(`CSS input file not found: ${cssFilePath}`);
    return;
  }

  try {
    const outputPath = path.resolve(outputDir, cssConfig.output);
    const outputDirPath = path.dirname(outputPath);

    await ensureDir(outputDirPath);
    // Zero-copy file transfer using Bun's native API
    await Bun.write(outputPath, cssFile);

    console.log("✅ CSS file copied successfully (fallback mode)");
  } catch (error) {
    console.error("Error in fallback CSS generation:", error);
  }
}

/**
 * Copy static assets from templates/assets and public/ directories
 * @param templatesDir - Templates directory
 * @param outputDir - Output directory
 */
export async function copyStaticAssets(
  templatesDir: string,
  outputDir: string,
  projectRoot = process.cwd(),
): Promise<void> {
  // Keep public files last so they retain precedence over template assets.
  for (const [source, target] of [
    [path.join(templatesDir, "assets"), path.join(outputDir, "assets")],
    [path.join(projectRoot, "public"), outputDir],
  ]) {
    if (!(await isDirectory(source))) continue;
    const files = Array.from(
      new Glob("**/*").scanSync({
        cwd: source,
        absolute: true,
        dot: true,
        onlyFiles: true,
      }),
    );
    await mapConcurrent(files, async (file) => {
      const destination = path.join(target, path.relative(source, file));
      await ensureDir(path.dirname(destination));
      await copyFile(file, destination);
    });
  }
}
