#!/usr/bin/env bun
import { Command } from "commander";
import { registerCssCommand } from "./cli/commands/css";
import { registerGenerateCommand } from "./cli/commands/generate";
import { registerImagesPushCommand } from "./cli/commands/images-push";
import { registerInitCommand } from "./cli/commands/init";
import { registerNewCommand } from "./cli/commands/new-post";
import { registerServeCommand } from "./cli/commands/serve";
import { registerValidateCommand } from "./cli/commands/validate";

const program = new Command();

// Register modular commands
registerInitCommand(program);
registerNewCommand(program);
registerGenerateCommand(program);
registerServeCommand(program);
registerCssCommand(program);
registerImagesPushCommand(program);
registerValidateCommand(program);

program
  .name("bunki")
  .description("An opinionated static site generator built with Bun")
  .version("0.9.1");

// When called directly (not imported)
// This ensures it works both as ESM import and when executed directly
// Handle both file:// URLs and plain paths for Bun compatibility
const currentFile = import.meta.url.replace("file://", "");
const mainFile = Bun.main;
if (currentFile === mainFile || currentFile.endsWith(mainFile)) {
  program.parse(Bun.argv);
}
