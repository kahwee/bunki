import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  archiveIntegrity,
  compareVersions,
  registryState,
  verifyPublished,
} from "./archive-registry.mjs";

const pkg = { name: "example-package", version: "2.10.0" };
const integrity = archiveIntegrity(Buffer.from("checked tarball"));
const entry = (version, hash = integrity) => ({
  name: pkg.name,
  version,
  dist: { integrity: hash },
});
const data = (latest, versions = { [latest]: entry(latest) }) => ({
  name: pkg.name,
  "dist-tags": { latest },
  versions,
});
const response =
  (body, status = 200) =>
  async () => ({ status, json: async () => body });

test("compares unbounded stable version components", () => {
  assert.equal(compareVersions("2.10.0", "2.9.99"), 1);
  assert.equal(compareVersions("999999999999999999999.0.0", "1000000000000000000000.0.0"), -1);
  assert.equal(compareVersions("2.10.0", "2.10.0"), 0);
  assert.throws(() => compareVersions("2.01.0", "2.1.0"));
});

test("existing archives are immutable and newer latest is preserved", async () => {
  await assert.rejects(registryState(pkg, integrity, response(null, 404)), /not found/);
  assert.equal(await registryState(pkg, integrity, response(data("2.9.0"))), "new");
  const versions = { "2.10.0": entry("2.10.0"), "3.0.0": entry("3.0.0") };
  assert.equal(await registryState(pkg, integrity, response(data("3.0.0", versions))), "published");
  await verifyPublished(pkg, integrity, { request: response(data("3.0.0", versions)) });
  await assert.rejects(registryState(pkg, integrity, response(data("3.0.0"))), /Refusing/);
  versions["2.10.0"] = entry("2.10.0", "sha512-different");
  await assert.rejects(
    registryState(pkg, integrity, response(data("3.0.0", versions))),
    /integrity/,
  );
  await assert.rejects(
    verifyPublished(pkg, integrity, { request: response(data("3.0.0", versions)) }),
    /integrity/,
  );
});

test("readback retries propagation only and exhausts a finite budget", async () => {
  let calls = 0;
  let sleeps = 0;
  const request = async () =>
    ++calls === 1 ? { status: 404 } : { status: 200, json: async () => data(pkg.version) };
  await verifyPublished(pkg, integrity, {
    request,
    sleep: async () => {
      sleeps++;
    },
  });
  assert.equal(calls, 2);
  assert.equal(sleeps, 1);
  await assert.rejects(
    verifyPublished(pkg, integrity, {
      request: response(null, 404),
      attempts: 3,
      sleep: async () => {},
    }),
    /exhausted 3/,
  );
  calls = 0;
  await assert.rejects(
    verifyPublished(pkg, integrity, {
      request: async () => {
        calls++;
        return { status: 403 };
      },
      sleep: async () => {},
    }),
    /HTTP 403/,
  );
  assert.equal(calls, 1);
});

test("registry errors and malformed or inconsistent metadata fail closed", async () => {
  for (const status of [401, 403, 429, 500])
    await assert.rejects(registryState(pkg, integrity, response(null, status)));
  for (const body of [
    {},
    { ...data("2.9.0"), name: "wrong" },
    data("bad"),
    { ...data("2.9.0"), versions: {} },
    data("2.9.0", { "2.9.0": entry("wrong") }),
  ]) {
    await assert.rejects(registryState(pkg, integrity, response(body)));
  }
  await assert.rejects(
    registryState(pkg, integrity, async () => ({
      status: 200,
      json: async () => {
        throw new Error("bad JSON");
      },
    })),
  );
  await assert.rejects(
    registryState(
      pkg,
      integrity,
      response(data(pkg.version, { [pkg.version]: { ...entry(pkg.version), name: "wrong" } })),
    ),
  );
});

test("missing version and older latest can propagate", async () => {
  let calls = 0;
  let sleeps = 0;
  const stages = [
    data("2.9.0"),
    data("2.9.0", { "2.9.0": entry("2.9.0"), [pkg.version]: entry(pkg.version) }),
    data(pkg.version),
  ];
  await verifyPublished(pkg, integrity, {
    request: async () => ({ status: 200, json: async () => stages[calls++] }),
    sleep: async () => {
      sleeps++;
    },
  });
  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
});

test("local tarball integrity gates existing-version upload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-guard-"));
  try {
    writeFileSync(join(dir, "content"), "checked package");
    execFileSync("tar", ["-czf", join(dir, "package.tgz"), "-C", dir, "content"]);
    const checked = archiveIntegrity(readFileSync(join(dir, "package.tgz")));
    const published = data(pkg.version, { [pkg.version]: entry(pkg.version, checked) });
    assert.equal(await registryState(pkg, checked, response(published)), "published");
    await assert.rejects(
      registryState(pkg, archiveIntegrity(Buffer.from("different")), response(published)),
      /integrity/,
    );
    await assert.rejects(
      verifyPublished(pkg, checked, {
        request: response(data("2.9.0")),
        attempts: 2,
        sleep: async () => {},
      }),
      /exhausted 2/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("inactive proposal preserves trigger, permissions and upload gate", () => {
  const workflow = readFileSync(
    new URL("../.github/release-proposals/publish.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /on:\s*\n  push:\s*\n    tags: \["v\*"\]/);
  assert.match(workflow, /python3 scripts\/release-assets.py/);
  assert.match(workflow, /name: Preserve top-level distribution assets for GitHub/);
  assert.match(
    workflow,
    /group: npm-release-bunki\s*\n  queue: max\s*\n  cancel-in-progress: false/,
  );
  assert.match(workflow, /permissions:\s*\n  contents: read/);
  assert.match(
    workflow,
    /permissions:\s*\n      contents: read\s*\n      actions: read\s*\n      id-token: write/,
  );
  assert.equal((workflow.match(/id-token: write/g) || []).length, 1);
  assert.equal((workflow.match(/npm publish /g) || []).length, 1);
  assert.match(workflow, /if: steps.metadata.outputs.should_publish == 'true'/);
  assert.match(workflow, /--archive-registry/);
  assert.match(workflow, /--verify-archive/);
});
test("active token publisher remains byte-for-byte unchanged", () => {
  const workflow = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url));
  assert.equal(
    createHash("sha256").update(workflow).digest("hex"),
    "854e13eb1e92a74d5705727ded460f8f154a5349ab777277bb9d6e2035a8e78e",
  );
});

test("legacy registry CLI still works without an archive", () => {
  const dir = mkdtempSync(join(tmpdir(), "legacy-guard-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    const hook = join(dir, "fetch.mjs");
    writeFileSync(
      hook,
      `globalThis.fetch = async () => ({ status: Number(process.env.TEST_STATUS), json: async () => JSON.parse(process.env.TEST_BODY) });`,
    );
    const script = new URL("./release-check.mjs", import.meta.url).pathname;
    const run = (status, body) =>
      spawnSync(process.execPath, ["--import", hook, script, "v2.10.0", "--registry"], {
        cwd: dir,
        env: {
          ...process.env,
          GITHUB_OUTPUT: join(dir, "output"),
          TEST_STATUS: String(status),
          TEST_BODY: JSON.stringify(body),
        },
      });
    assert.equal(run(404, {}).status, 0);
    assert.match(readFileSync(join(dir, "output"), "utf8"), /should_publish=true/);
    writeFileSync(join(dir, "output"), "");
    assert.equal(run(200, pkg).status, 0);
    assert.match(readFileSync(join(dir, "output"), "utf8"), /should_publish=false/);
    assert.equal(run(200, { ...pkg, name: "wrong" }).status, 1);
    assert.equal(run(403, {}).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
