import { Command } from "commander";
import path from "path";
import { DEFAULT_OUTPUT_DIR, loadConfig } from "../../config";
import { getDefaultCSSConfig, processCSS, watchCSS } from "../../utils/css-processor";

interface CssDeps {
  loadConfig: typeof loadConfig;
  processCSS: typeof processCSS;
  watchCSS: typeof watchCSS;
  getDefaultCSSConfig: typeof getDefaultCSSConfig;
  logger: Pick<typeof console, "log" | "error">;
  exit: (code: number) => void;
}

const defaultDeps: CssDeps = {
  loadConfig,
  processCSS,
  watchCSS,
  getDefaultCSSConfig,
  logger: console,
  exit: (code) => process.exit(code),
};

export async function handleCssCommand(
  options: { config: string; output: string; watch?: boolean },
  deps: CssDeps = defaultDeps,
): Promise<void> {
  try {
    const configPath = path.resolve(options.config);
    const outputDir = path.resolve(options.output);

    const config = await deps.loadConfig(configPath);
    const cssConfig = config.css || deps.getDefaultCSSConfig();

    if (!cssConfig.enabled) {
      deps.logger.log("CSS processing is disabled in configuration");
      return;
    }

    const processorOptions = {
      css: cssConfig,
      projectRoot: process.cwd(),
      outputDir,
      verbose: true,
    } as const;

    if (options.watch) {
      deps.logger.log("Starting CSS watch mode...");
      cssConfig.watch = true;
      await deps.processCSS(processorOptions);
      await deps.watchCSS(processorOptions);
    } else {
      await deps.processCSS(processorOptions);
    }
  } catch (error) {
    deps.logger.error("Error processing CSS:", error);
    deps.exit(1);
  }
}

export function registerCssCommand(program: Command): Command {
  return program
    .command("css")
    .description("Process CSS using PostCSS")
    .option("-c, --config <file>", "Config file path", "bunki.config.ts")
    .option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
    .option("-w, --watch", "Watch for changes and rebuild")
    .action(async (options) => {
      await handleCssCommand(options);
    });
}
