import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function resolveReleaseSource(tag, eventSha, git = runGit) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error("A stable version tag is required");
  }
  if (!/^[a-f0-9]{40}$/.test(eventSha)) throw new Error("Invalid event SHA");
  const head = git(["rev-parse", "HEAD"]);
  const tagged = git(["rev-parse", `refs/tags/${tag}^{commit}`]);
  const eventCommit = git(["rev-parse", `${eventSha}^{commit}`]);
  if (head !== tagged || head !== eventCommit)
    throw new Error("Release source differs from event/tag");
  git(["merge-base", "--is-ancestor", head, "origin/main"]);
  return head;
}

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function requireTrustedCI(data, sha, repository) {
  const trusted = data?.workflow_runs?.some(
    (run) =>
      run.head_sha === sha &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.event === "push" &&
      run.head_branch === "main" &&
      run.path === ".github/workflows/ci.yml" &&
      run.repository?.full_name === repository &&
      run.head_repository?.full_name === repository,
  );
  if (!trusted) throw new Error("No successful main-branch CI run for this exact source");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.GITHUB_REPOSITORY !== "kahwee/bunki")
      throw new Error("Unexpected release repository");
    const sha = resolveReleaseSource(process.argv[2], process.env.GITHUB_SHA);
    const response = await fetch(
      `https://api.github.com/repos/kahwee/bunki/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&status=success&per_page=100`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${process.env.GH_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error(`CI lookup failed (HTTP ${response.status})`);
    requireTrustedCI(await response.json(), sha, "kahwee/bunki");
    console.log(`Verified main ancestry and CI for ${sha}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
