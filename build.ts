#!/usr/bin/env bun

import path from "node:path";
import { $ } from "bun";

const projectRoot = import.meta.dir;
const distDir = path.join(projectRoot, "dist");

async function buildProject(): Promise<void> {
  console.log("Building bunki...");

  await $`rm -rf ${distDir}`;

  const result = await Bun.build({
    entrypoints: [
      path.join(projectRoot, "src", "index.ts"),
      path.join(projectRoot, "src", "cli.ts"),
    ],
    outdir: distDir,
    target: "bun",
    format: "esm",
    sourcemap: "external",
    minify: false,
    naming: "[dir]/[name].[ext]",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Bun build failed");
  }

  const cliPath = path.join(distDir, "cli.js");
  const cli = Bun.file(cliPath);
  const cliContent = await cli.text();
  if (!cliContent.startsWith("#!/usr/bin/env bun")) {
    await Bun.write(cliPath, `#!/usr/bin/env bun\n${cliContent}`);
  }

  await $`chmod +x ${cliPath}`;
  await $`cp -R ${path.join(projectRoot, "src", "fragments")} ${path.join(distDir, "fragments")}`;
  await $`bun tsc --declaration --emitDeclarationOnly --outDir ${distDir}`;

  console.log("Build completed successfully! ✅");
}

if (import.meta.main) {
  await buildProject();
}
