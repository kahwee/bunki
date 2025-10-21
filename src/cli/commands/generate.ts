import { Command } from "commander";
import path from "path";
import { DEFAULT_CONTENT_DIR, DEFAULT_OUTPUT_DIR, DEFAULT_TEMPLATES_DIR, loadConfig } from "../../config";
import { SiteGenerator } from "../../site-generator";

interface GenerateDeps {
  loadConfig: typeof loadConfig;
  createGenerator: (opts: ConstructorParameters<typeof SiteGenerator>[0]) => SiteGenerator;
  logger: Pick<typeof console, "log" | "error">;
  exit: (code: number) => void;
}

const defaultDeps: GenerateDeps = {
  loadConfig,
  createGenerator: (opts) => new SiteGenerator(opts),
  logger: console,
  exit: (code) => process.exit(code),
};

export async function handleGenerateCommand(
  options: { config: string; content: string; output: string; templates: string },
  deps: GenerateDeps = defaultDeps,
): Promise<void> {
  try {
    const configPath = path.resolve(options.config);
    const contentDir = path.resolve(options.content);
    const outputDir = path.resolve(options.output);
    const templatesDir = path.resolve(options.templates);

    deps.logger.log("Generating site with:");
    deps.logger.log(`- Config file: ${configPath}`);
    deps.logger.log(`- Content directory: ${contentDir}`);
    deps.logger.log(`- Output directory: ${outputDir}`);
    deps.logger.log(`- Templates directory: ${templatesDir}`);

    const config = await deps.loadConfig(configPath);
    const generator = deps.createGenerator({ contentDir, outputDir, templatesDir, config });
    await generator.initialize();
    await generator.generate();

    deps.logger.log("Site generation completed successfully!");
  } catch (error) {
    deps.logger.error("Error generating site:", error);
    deps.exit(1);
  }
}

export function registerGenerateCommand(program: Command): Command {
  return program
    .command("generate")
    .description("Generate static site from markdown content")
    .option("-c, --config <file>", "Config file path", "bunki.config.ts")
    .option("-d, --content <dir>", "Content directory", DEFAULT_CONTENT_DIR)
    .option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
    .option("-t, --templates <dir>", "Templates directory", DEFAULT_TEMPLATES_DIR)
    .action(async (options) => {
      await handleGenerateCommand(options);
    });
}
