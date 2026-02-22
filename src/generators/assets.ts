/**
 * Asset generation - CSS and static file copying
 */

import { Glob } from "bun";
import path from "path";
import type { SiteConfig } from "../types";
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
      projectRoot: process.cwd(),
      outputDir,
      verbose: true,
    });
  } catch (error) {
    console.error("Error processing CSS:", error);

    // Fallback to simple file copying if PostCSS fails
    console.log("Falling back to simple CSS file copying...");
    await fallbackCSSGeneration(cssConfig, outputDir);
  }
}

/**
 * Fallback CSS generation - direct file copy without processing
 * @param cssConfig - CSS configuration
 * @param outputDir - Output directory
 */
async function fallbackCSSGeneration(
  cssConfig: any,
  outputDir: string,
): Promise<void> {
  const cssFilePath = path.resolve(process.cwd(), cssConfig.input);
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
): Promise<void> {
  const assetsDir = path.join(templatesDir, "assets");
  const publicDir = path.join(process.cwd(), "public");

  // Copy template assets
  if (await isDirectory(assetsDir)) {
    const assetGlob = new Glob("**/*.*");
    const assetsOutputDir = path.join(outputDir, "assets");

    await ensureDir(assetsOutputDir);

    for await (const file of assetGlob.scan({
      cwd: assetsDir,
      absolute: true,
    })) {
      const relativePath = path.relative(assetsDir, file);
      const targetPath = path.join(assetsOutputDir, relativePath);

      const targetDir = path.dirname(targetPath);
      await ensureDir(targetDir);

      await copyFile(file, targetPath);
    }
  }

  // Copy public directory (including dotfiles and extensionless files)
  if (await isDirectory(publicDir)) {
    const publicGlob = new Glob("**/*");

    for await (const file of publicGlob.scan({
      cwd: publicDir,
      absolute: true,
      dot: true, // Include dotfiles
    })) {
      // Skip if path is a directory (Glob returns both files and dirs)
      if (await isDirectory(file)) continue;

      const relativePath = path.relative(publicDir, file);
      const destPath = path.join(outputDir, relativePath);

      const targetDir = path.dirname(destPath);
      await ensureDir(targetDir);
      await copyFile(file, destPath);
    }

    console.log(
      "Copied public files to site (including extensionless & dotfiles)",
    );
  }
}
