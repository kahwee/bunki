/**
 * Validate markdown files for parsing errors
 */

import { Command } from "commander";
import { parseMarkdownDirectory } from "../../parser";
import { loadConfig } from "../../config";

export function registerValidateCommand(program: Command) {
  program
    .command("validate")
    .description("Validate markdown files for parsing errors")
    .option("-c, --config <path>", "Path to config file", "bunki.config.ts")
    .action(async (options: { config: string }) => {
      try {
        const config = await loadConfig(options.config);

        console.log("🔍 Validating markdown files...\n");

        const contentDir = "./content";

        // Run validation in strict mode to get all errors
        try {
          await parseMarkdownDirectory(contentDir, true);
          console.log("\n✅ All markdown files are valid!");
          process.exit(0);
        } catch (error: any) {
          // Errors are already logged by parseMarkdownDirectory
          console.error("\n❌ Validation failed\n");
          process.exit(1);
        }
      } catch (error: any) {
        console.error("Error during validation:", error.message);
        process.exit(1);
      }
    });
}
