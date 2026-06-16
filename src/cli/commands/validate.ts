import type { Command } from "commander";
import { loadConfig } from "../../config";
import { parseMarkdownDirectory } from "../../parser";
import type { SiteConfig } from "../../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerValidateCommand(program: Command) {
  program
    .command("validate")
    .description("Validate markdown files for parsing errors")
    .option("-c, --config <path>", "Path to config file", "bunki.config.ts")
    .option("-d, --dir <path>", "Override content directory")
    .action(async (options: { config: string; dir?: string }) => {
      let config: SiteConfig;
      try {
        config = await loadConfig(options.config);
      } catch (error) {
        console.error(`Failed to load config: ${getErrorMessage(error)}`);
        process.exit(1);
      }

      const contentDir = options.dir ?? config.contentDir ?? "./content";

      console.log(`🔍 Validating markdown files in "${contentDir}"...\n`);

      try {
        await parseMarkdownDirectory(contentDir, true);
        console.log("✅ All markdown files are valid!");
      } catch (error) {
        console.error(`\n❌ Validation failed: ${getErrorMessage(error)}\n`);
        process.exit(1);
      }
    });
}
