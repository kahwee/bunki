import { Command } from "commander";
import path from "path";
import { createDefaultConfig } from "../../config";
import { ensureDir } from "../../utils/file-utils";
import { nunjucks, defaultCss, samplePost } from "./templates";

type WriteFileFn = (filePath: string, data: string) => Promise<number>;

interface InitDependencies {
  createDefaultConfig: typeof createDefaultConfig;
  ensureDir: typeof ensureDir;
  writeFile: WriteFileFn;
  logger: Pick<typeof console, "log" | "error">;
  exit: (code: number) => void;
}

const defaultDependencies: InitDependencies = {
  createDefaultConfig,
  ensureDir,
  writeFile: (filePath, data) => Bun.write(filePath, data),
  logger: console,
  exit: (code) => process.exit(code),
};

export async function handleInitCommand(
  options: { config: string },
  deps: InitDependencies = defaultDependencies,
): Promise<void> {
  try {
    const configPath = path.resolve(options.config);
    const configCreated = await deps.createDefaultConfig(configPath);

    if (!configCreated) {
      deps.logger.log(
        "\nSkipped initialization because the config file already exists",
      );
      return;
    }

    deps.logger.log("Creating directory structure...");

    const baseDir = process.cwd();
    const contentDir = path.join(baseDir, "content");
    const templatesDir = path.join(baseDir, "templates");
    const stylesDir = path.join(templatesDir, "styles");
    const publicDir = path.join(baseDir, "public");

    await deps.ensureDir(contentDir);
    await deps.ensureDir(templatesDir);
    await deps.ensureDir(stylesDir);
    await deps.ensureDir(publicDir);

    for (const [filename, content] of Object.entries(nunjucks)) {
      await deps.writeFile(path.join(templatesDir, filename), content);
    }

    await deps.writeFile(path.join(stylesDir, "main.css"), defaultCss);

    await deps.writeFile(path.join(contentDir, "welcome.md"), samplePost);

    deps.logger.log("\nInitialization complete! Here are the next steps:");
    deps.logger.log("1. Edit bunki.config.ts to configure your site");
    deps.logger.log("2. Add markdown files to the content directory");
    deps.logger.log('3. Run "bunki generate" to build your site');
    deps.logger.log('4. Run "bunki serve" to preview your site locally');
  } catch (error) {
    deps.logger.error("Error initializing site:", error);
    deps.exit(1);
  }
}

export function registerInitCommand(
  program: Command,
  deps: InitDependencies = defaultDependencies,
): Command {
  return program
    .command("init")
    .description("Initialize a new site with default structure")
    .option("-c, --config <file>", "Path to config file", "bunki.config.ts")
    .action(async (options) => {
      await handleInitCommand(options, deps);
    });
}
