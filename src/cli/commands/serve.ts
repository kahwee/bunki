import { Command } from "commander";
import path from "path";
import { DEFAULT_OUTPUT_DIR } from "../../config";
import { startServer } from "../../server";

interface ServeDeps {
  startServer: typeof startServer;
  logger: Pick<typeof console, "error">;
  exit: (code: number) => void;
}

const defaultDeps: ServeDeps = {
  startServer,
  logger: console,
  exit: (code) => process.exit(code),
};

export async function handleServeCommand(
  options: { output: string; port: string },
  deps: ServeDeps = defaultDeps,
): Promise<void> {
  try {
    const outputDir = path.resolve(options.output);
    const port = parseInt(options.port, 10);
    await deps.startServer(outputDir, port);
  } catch (error) {
    deps.logger.error("Error starting dev server:", error);
    deps.exit(1);
  }
}

export function registerServeCommand(program: Command): Command {
  return program
    .command("serve")
    .description("Start a local development server")
    .option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
    .option("-p, --port <number>", "Port number", "3000")
    .action(async (options) => {
      await handleServeCommand(options);
    });
}
