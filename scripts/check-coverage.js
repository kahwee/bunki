#!/usr/bin/env bun

/**
 * Simple script to check and print code coverage information
 * Run with: bun run scripts/check-coverage.js
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

// Run tests with coverage
console.log("Running tests with coverage...");
const result = spawnSync("bun", ["test", "--coverage"], { stdio: "pipe" });
console.log(result.stdout.toString());

// Check if coverage report exists
const coverageDir = path.join(process.cwd(), "coverage");
if (!fs.existsSync(coverageDir)) {
  console.error(
    "No coverage directory found. Make sure tests are generating coverage reports.",
  );
  process.exit(1);
}

// Print coverage summary
console.log("\nCoverage Summary:");
try {
  const coverageSummary = path.join(coverageDir, "coverage-summary.json");
  if (fs.existsSync(coverageSummary)) {
    const summary = JSON.parse(fs.readFileSync(coverageSummary, "utf8"));
    const total = summary.total;

    console.log(`Lines: ${total.lines.pct}%`);
    console.log(`Statements: ${total.statements.pct}%`);
    console.log(`Functions: ${total.functions.pct}%`);
    console.log(`Branches: ${total.branches.pct}%`);
  } else {
    console.log("No coverage summary found. Check the coverage directory.");
  }
} catch (error) {
  console.error("Error parsing coverage summary:", error.message);
}

console.log("\nCoverage report is available in the coverage/ directory");
console.log(
  "Open coverage/lcov-report/index.html in your browser to view the detailed report",
);
