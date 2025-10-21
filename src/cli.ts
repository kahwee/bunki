#!/usr/bin/env bun
import { Command } from "commander";
import { registerCssCommand } from "./cli/commands/css";
import { registerGenerateCommand } from "./cli/commands/generate";
import { registerImagesPushCommand } from "./cli/commands/images-push";
import { registerInitCommand } from "./cli/commands/init";
import { registerNewCommand } from "./cli/commands/new-post";
import { registerServeCommand } from "./cli/commands/serve";

const program = new Command();

// Register modular commands
registerInitCommand(program);
registerNewCommand(program);
registerGenerateCommand(program);
registerServeCommand(program);
registerCssCommand(program);
registerImagesPushCommand(program);

program
  .name("bunki")
  .description("An opinionated static site generator built with Bun")
  .version("0.5.3");

// When called directly (not imported)
// This ensures it works both as ESM import and when executed directly
if (import.meta.url === Bun.main) {
  program.parse(Bun.argv);
}
