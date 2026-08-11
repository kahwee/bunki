#!/usr/bin/env bun
import { Command } from "commander";
import packageJson from "../package.json";
import { registerCssCommand } from "./cli/commands/css";
import { registerGenerateCommand } from "./cli/commands/generate";
import { registerImagesPushCommand } from "./cli/commands/images-push";
import { registerInitCommand } from "./cli/commands/init";
import { registerNewCommand } from "./cli/commands/new-post";
import { registerServeCommand } from "./cli/commands/serve";
import { registerValidateCommand } from "./cli/commands/validate";
import { registerValidateMediaCommand } from "./cli/commands/validate-media";

const program = new Command();

registerInitCommand(program);
registerNewCommand(program);
registerGenerateCommand(program);
registerServeCommand(program);
registerCssCommand(program);
registerImagesPushCommand(program);
registerValidateCommand(program);
registerValidateMediaCommand(program);

program
  .name("bunki")
  .description("An opinionated static site generator built with Bun")
  .version(packageJson.version);

if (import.meta.main) {
  program.parse(Bun.argv);
}

export { program };
