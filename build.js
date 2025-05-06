#!/usr/bin/env bun

import { spawn } from "child_process";
import { join } from "path";

async function buildProject() {
  console.log("Building bunki...");

  try {
    // Build the library
    await runCommand("bun", [
      "build",
      "./src/index.ts",
      "--outdir",
      "./dist",
      "--target",
      "bun",
    ]);

    // Build the CLI with shebang
    await runCommand("bun", [
      "build",
      "./src/cli.ts",
      "--outdir",
      "./dist",
      "--target",
      "bun",
    ]);

    // Add shebang to CLI file
    const cliPath = join(process.cwd(), "dist", "cli.js");
    await prependShebangToCLI(cliPath);

    // Make CLI executable
    await runCommand("chmod", ["+x", "./dist/cli.js"]);

    console.log("Build completed successfully! ✅");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(" ")}`);

    const proc = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

async function prependShebangToCLI(filePath) {
  try {
    // Read existing content
    const file = Bun.file(filePath);
    const content = await file.text();

    // Check if already has shebang
    if (!content.startsWith("#!/usr/bin/env bun")) {
      // Prepend shebang
      const updatedContent = `#!/usr/bin/env bun\n${content}`;
      await Bun.write(filePath, updatedContent);
      console.log(`Added shebang to ${filePath}`);
    }
  } catch (error) {
    console.error(`Error adding shebang: ${error.message}`);
    throw error;
  }
}

// Run the build process
buildProject().catch(console.error);
