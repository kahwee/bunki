#!/usr/bin/env bun

import { join } from "path";

// Configuration
const FIXTURES_DIR = join(process.cwd(), "fixtures");
const OUTPUT_DIR = join(FIXTURES_DIR, "dist");

/**
 * Run a command and return its output
 * @param {string} cmd Command to run
 * @param {string[]} args Command arguments
 * @returns {Promise<string>} Command output
 */
async function runCommand(cmd, args) {
  console.log(`Running: ${cmd} ${args.join(" ")}`);

  const proc = Bun.spawn([cmd, ...args], {
    cwd: FIXTURES_DIR,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}\n${stderr}`);
  }

  return output;
}

/**
 * Run the fixture tests
 */
async function runFixtureTests() {
  console.log("🧪 Running Bunki fixture tests");
  console.log("============================");

  try {
    // Step 1: Generate the site
    console.log("\n📝 Generating site from fixtures...");
    const generateStart = performance.now();
    const generateOutput = await runCommand("bunki", ["generate"]);
    const generateTime = performance.now() - generateStart;

    console.log(`✅ Site generation completed in ${generateTime.toFixed(2)}ms`);

    // Step 2: Verify output files exist
    console.log("\n🔍 Verifying generated files...");
    const verifyStart = performance.now();
    const verifyOutput = await runCommand("find", [
      "dist",
      "-type",
      "f",
      "|",
      "wc",
      "-l",
    ]);
    const fileCount = parseInt(verifyOutput.trim(), 10);
    const verifyTime = performance.now() - verifyStart;

    console.log(
      `✅ Found ${fileCount} generated files (verification took ${verifyTime.toFixed(2)}ms)`,
    );

    // Step 3: Start server (briefly) to test serving capability
    console.log("\n🌐 Testing server functionality...");
    const serveStart = performance.now();

    // Start the server in the background
    const server = Bun.spawn(["bunki", "serve", "--port", "3457"], {
      cwd: FIXTURES_DIR,
      stdout: "pipe",
      stderr: "pipe",
    });

    // Wait a moment for the server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test if the server is responding
    try {
      const response = await fetch("http://localhost:3457/");
      const status = response.status;
      console.log(`✅ Server responded with status ${status}`);
    } catch (error) {
      console.error(`❌ Failed to connect to server: ${error.message}`);
    }

    // Kill the server
    server.kill();

    const serveTime = performance.now() - serveStart;
    console.log(`✅ Server test completed in ${serveTime.toFixed(2)}ms`);

    // Summary
    console.log("\n📊 Test Summary");
    console.log("==============");
    console.log(`Total files generated: ${fileCount}`);
    console.log(`Generation time: ${generateTime.toFixed(2)}ms`);
    console.log(`Server test time: ${serveTime.toFixed(2)}ms`);
    console.log(`\n✨ All tests completed successfully!`);
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the tests
runFixtureTests().catch(console.error);
