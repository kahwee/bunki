import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
const section = (name, next) => workflow.split(`\n  ${name}:\n`)[1]?.split(`\n  ${next}:\n`)[0];

test("npm credentials are isolated from all repository code and package lifecycle scripts", () => {
  const build = section("test-and-build", "publish");
  const publish = section("publish", "verify");
  const verify = section("verify", "github-release");
  assert.ok(build && publish && verify);
  for (const readOnlyJob of [build, verify]) {
    assert.doesNotMatch(readOnlyJob, /secrets\.|id-token:\s*write|contents:\s*write/);
  }
  assert.match(build, /node scripts\/release-source\.mjs/);
  assert.match(build, /bun pm pack --ignore-scripts/);
  assert.match(build, /--archive-registry/);
  assert.doesNotMatch(
    publish,
    /checkout@|uses: \.\/|bun |npm (?:ci|install)|node scripts\/|id-token:\s*write/,
  );
  assert.match(publish, /sha256sum --check --strict/);
  assert.match(
    publish,
    /npm publish "\$RUNNER_TEMP\/release\/package\.tgz" --ignore-scripts --access public --tag latest --registry https:\/\/registry\.npmjs\.org/,
  );
  assert.equal((workflow.match(/secrets\.NPM_TOKEN/g) ?? []).length, 1);
  assert.match(verify, /--verify-archive/);
});
