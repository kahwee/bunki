import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { requireTrustedCI, resolveReleaseSource } from "./release-source.mjs";

const sha = "a".repeat(40);
const repository = "kahwee/bunki";
const valid = {
  head_sha: sha,
  status: "completed",
  conclusion: "success",
  event: "push",
  head_branch: "main",
  path: ".github/workflows/ci.yml",
  repository: { full_name: repository },
  head_repository: { full_name: repository },
};

test("only exact-source successful main CI in the expected repository is trusted", () => {
  requireTrustedCI({ workflow_runs: [valid] }, sha, repository);
  for (const changed of [
    { head_sha: "b".repeat(40) },
    { status: "in_progress" },
    { conclusion: "failure" },
    { event: "pull_request" },
    { head_branch: "feature" },
    { path: ".github/workflows/other.yml" },
    { repository: { full_name: "attacker/bunki" } },
    { head_repository: { full_name: "attacker/bunki" } },
  ]) {
    assert.throws(() =>
      requireTrustedCI({ workflow_runs: [{ ...valid, ...changed }] }, sha, repository),
    );
  }
  for (const data of [null, {}, { workflow_runs: [] }]) {
    assert.throws(() => requireTrustedCI(data, sha, repository));
  }
});

test("tags must resolve to the checked event commit on main ancestry", () => {
  const directory = mkdtempSync(join(tmpdir(), "bunki-release-source-"));
  const git = (args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    }).trim();
  try {
    git(["init", "-b", "main"]);
    writeFileSync(join(directory, "file"), "safe");
    git(["add", "file"]);
    git(["commit", "-m", "trusted"]);
    const trusted = git(["rev-parse", "HEAD"]);
    git(["update-ref", "refs/remotes/origin/main", trusted]);
    git(["tag", "v1.2.3"]);
    assert.equal(resolveReleaseSource("v1.2.3", trusted, git), trusted);
    git(["tag", "-a", "v1.2.4", "-m", "annotated"]);
    assert.equal(resolveReleaseSource("v1.2.4", git(["rev-parse", "v1.2.4"]), git), trusted);
    for (const tag of ["main", "v1.2.3-rc.1", "v01.2.3", "--help"]) {
      assert.throws(() => resolveReleaseSource(tag, trusted, git));
    }
    assert.throws(() => resolveReleaseSource("v1.2.3", "--help", git));
    git(["switch", "-c", "unreviewed"]);
    writeFileSync(join(directory, "file"), "unreviewed");
    git(["commit", "-am", "unreviewed"]);
    const unreviewed = git(["rev-parse", "HEAD"]);
    git(["tag", "v9.9.9"]);
    assert.throws(() => resolveReleaseSource("v1.2.3", trusted, git));
    assert.throws(() => resolveReleaseSource("v9.9.9", trusted, git));
    assert.throws(() => resolveReleaseSource("v9.9.9", unreviewed, git));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
