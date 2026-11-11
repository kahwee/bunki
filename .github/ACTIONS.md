kahwee
bunki
Type / to search
Repository navigation
Code
Issues
Pull requests
4
 (4)
Agents
Actions
Projects
Wiki
Security and quality
5
 (5)
Insights
Settings
Files
fix/protected-npm-publishing
t
T
.github
actions
release-proposals
workflows
ACTIONS.md
dependabot.yml
.husky
.vscode
content
docs
fixtures
public
scripts
src
templates
test
.coveralls.yml
.gitignore
.prettierignore
.prettierrc.json
AGENTS.md
CHANGELOG.md
CLAUDE.md
CONTRIBUTING.md
LICENSE
README.md
build.ts
bun.lock
bunfig.toml
package.json
test-fixtures.js
tsconfig.json
Breadcrumbs
bunki/.github
/ACTIONS.md
Latest commit
kahwee
fix: enforce content and release trust boundaries (#66)
e5f8f21
 · 
History
History
File metadata and controls
Preview
Code
Blame
106 lines (79 loc) · 8.32 KB
Raw
GitHub Actions maintenance

This guide describes the checked-in workflows. Follow each linked YAML file for branch filters, job dependencies, permissions, and release conditions.

Workflows
Workflow	Events	Jobs
ci.yml	push, pull_request	build
compatibility.yml	push, pull_request, workflow_dispatch	test-bun-versions
coverage.yml	push, pull_request	coverage
pr-coverage.yml	pull_request	coverage-comment
publish.yml	push to v* tags	test-and-build, publish, verify, github-release
Parallel steps

Independent checks use GitHub Actions native parallel steps. The following groups run concurrently within a job:

ci.yml, job build: Bun check; Check code style; Run tests with coverage.
publish.yml, job test-and-build: Bun check; Check code style; Run tests with coverage. Artifact generation and the starter-site smoke test run after all pass; publication waits for that job.

Steps after a group wait for it to finish. Keep prerequisites before the group and dependent build, package, or deployment work afterward. Do not run commands that overwrite the same build directory or coverage output together. Parallel steps share the job workspace; they do not provide separate machines.

Action versions

Verified against upstream stable releases on 2026-10-22. Workflow, composite-action, and release-proposal references use immutable commit pins with version comments.

Action	Stable release	Commit
actions/cache	v6.1.0	55cc8345863c7cc4c66a329aec7e433d2d1c52a9
actions/checkout	v7.0.1	3d3c42e5aac5ba805825da76410c181273ba90b1
actions/download-artifact	v8.0.2	9000827ccba6bdab643e8b6fd33ac0654aef8333
actions/setup-node	v7.1.0	949feb2413d6458794dcd2491c4babbbce0c15c1
actions/upload-artifact	v7.0.2	cf430e030ddbb5b0abf93d22962f4752f3646cd9
coverallsapp/github-action	v2.3.8	8d6379e14d29928660c4ba802d8e85393440b329
oven-sh/setup-bun	v2.2.0	0c5077e51419868618aeaa5fe8019c62421857d6
romeovs/lcov-reporter-action	v0.4.0	87a815f34ec27a5826abba44ce09bbc688da58fd
softprops/action-gh-release	v3.0.3	efb35369e0ad2afab669f228072c1b0d510eae64
Greenkeeping

Dependabot configuration checks GitHub Actions weekly and groups their updates. Review the upstream release notes, runtime requirements, permissions, and changes to inputs or artifact behavior before merging. Update SHA pins to the release commit, retaining the version comment where present.

Update every reference to the affected action, including local composite actions under .github/actions/.
Keep frozen dependency installation and the repository’s declared toolchain versions aligned. Cache package downloads with a lockfile-based key; a cache hit does not replace installation or verification.
Check workflow YAML and review shell commands. Older workflow linters may not understand native parallel; GitHub execution must verify those groups.
Run the affected checks and inspect the resulting Actions run. Preserve matrix coverage, build dependencies, artifact paths, and release gates.
Refresh this guide when workflows, action references, or parallel groups change.

Use workflow concurrency to cancel superseded check runs where appropriate. Deployment and release cancellation have different consequences: preserve the workflow’s existing policy rather than copying check-run settings blindly. Repository permissions and job-level overrides are defined in the linked YAML files.

Bun tooling

Bun 1.4.4 provides native formatting and type checking. CI runs bun run format:check and bun run typecheck; Biome is no longer installed. Semantic lint rules previously supplied by Biome are not part of Bun formatting. Retain tests, declaration generation, package validation, and audit gates.

Frozen dependency installation uses bun ci. Vitest and declaration emitters remain where they provide existing coverage and published package artifacts.

Check and build order

Local check:source uses Bun’s parallel script runner for formatting, project checking, and tests. GitHub keeps these as independent parallel steps so failures remain visible. Builds and package checks wait for the source checks. Standalone build runs Bun checking first. After an explicit successful checker, CI uses build:artifacts; its TypeScript step emits declarations with --noCheck and does not provide a second semantic check.

Text-lockfile cache key

The setup action now hashes the committed bun.lock with GitHub’s hashFiles. It no longer shells out to hash files or falls back to the old binary bun.lockb format. Cache restoration still precedes bun ci; it never replaces frozen installation. The new key format can cause a one-time cold cache.

The generated starter-site smoke test verifies that plain CSS uses Bun’s native bundler and does not fall back to copying raw CSS. Plugin-based PostCSS compatibility is covered by the CSS processor tests.

Package artifact commands host their existing build tools under Bun. Source gates still finish before artifact generation; tests and coverage keep their existing runtime. Bun package caches use the default ~/.bun/install/cache directory. See build performance for the controlled comparison.

Release credential boundary

The active npm workflow requires a version tag on main ancestry and a successful ci.yml main-branch push run for that exact commit. Read-only jobs check, build, and pack the expected bunki package. Registry checks compare immutable archive integrity and refuse older versions from taking over latest.

The npm token is exposed only to one npm publish command on a fresh runner. That runner does not check out source, install dependencies, run local actions, or run package lifecycle scripts. It verifies the transferred archive digest and publishes that exact archive with --ignore-scripts. Registry readback runs separately without npm credentials; GitHub release creation runs without repository code.

These source checks are defense in depth, not a replacement for repository controls. Protect `main` with pull requests and required CI, and restrict `v*` tag creation and updates. Configure `npm-release` to allow only `v*` tags, require approval from `kahwee`, and disallow administrator bypass. Self-review remains allowed so the sole maintainer can approve their own releases.

The npm trusted publisher must match owner `kahwee`, repository `bunki`, workflow `publish.yml`, and environment `npm-release`, with `npm publish` allowed. Restrict npm publishing access to require two-factor authentication and disallow bypass tokens. Remove the repository-wide `NPM_TOKEN` secret after migration; the workflow no longer uses it. External settings and trust must be verified separately before tagging. The inactive OIDC proposal remains unused.
