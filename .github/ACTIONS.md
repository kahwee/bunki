# GitHub Actions maintenance

This guide describes the checked-in workflows. Follow each linked YAML file for branch filters, job dependencies, permissions, and release conditions.

## Workflows

| Workflow                                         | Events                                      | Jobs                        |
| ------------------------------------------------ | ------------------------------------------- | --------------------------- |
| [ci.yml](workflows/ci.yml)                       | `push`, `pull_request`                      | `build`                     |
| [compatibility.yml](workflows/compatibility.yml) | `push`, `pull_request`, `workflow_dispatch` | `test-bun-versions`         |
| [coverage.yml](workflows/coverage.yml)           | `push`, `pull_request`                      | `coverage`                  |
| [pr-coverage.yml](workflows/pr-coverage.yml)     | `pull_request`                              | `coverage-comment`          |
| [publish.yml](workflows/publish.yml)             | `push`, `workflow_dispatch`                 | `test-and-build`, `publish` |

## Parallel steps

Independent checks use GitHub Actions [native parallel steps](https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/). The following groups run concurrently within a job:

- [ci.yml](workflows/ci.yml), job `build`: `Bun check`; `Check code style`; `Run tests with coverage`.

Steps after a group wait for it to finish. Keep prerequisites before the group and dependent build, package, or deployment work afterward. Do not run commands that overwrite the same build directory or coverage output together. Parallel steps share the job workspace; they do not provide separate machines.

## Action versions

Verified against upstream stable releases on 2026-10-22. Workflow, composite-action,
and release-proposal references use immutable commit pins with version comments.

| Action                                                                          | Stable release | Commit                                     |
| ------------------------------------------------------------------------------- | -------------- | ------------------------------------------ |
| [actions/cache](https://github.com/actions/cache)                               | `v6.1.0`       | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| [actions/checkout](https://github.com/actions/checkout)                         | `v7.0.1`       | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/download-artifact](https://github.com/actions/download-artifact)       | `v8.0.2`       | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |
| [actions/setup-node](https://github.com/actions/setup-node)                     | `v7.1.0`       | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact)           | `v7.0.2`       | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| [coverallsapp/github-action](https://github.com/coverallsapp/github-action)     | `v2.3.8`       | `8d6379e14d29928660c4ba802d8e85393440b329` |
| [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun)                       | `v2.2.0`       | `0c5077e51419868618aeaa5fe8019c62421857d6` |
| [romeovs/lcov-reporter-action](https://github.com/romeovs/lcov-reporter-action) | `v0.4.0`       | `87a815f34ec27a5826abba44ce09bbc688da58fd` |
| [softprops/action-gh-release](https://github.com/softprops/action-gh-release)   | `v3.0.3`       | `efb35369e0ad2afab669f228072c1b0d510eae64` |

## Greenkeeping

[Dependabot configuration](dependabot.yml) checks GitHub Actions weekly and groups their updates. Review the upstream release notes, runtime requirements, permissions, and changes to inputs or artifact behavior before merging. Update SHA pins to the release commit, retaining the version comment where present.

1. Update every reference to the affected action, including local composite actions under `.github/actions/`.
2. Keep frozen dependency installation and the repository’s declared toolchain versions aligned. Cache package downloads with a lockfile-based key; a cache hit does not replace installation or verification.
3. Check workflow YAML and review shell commands. Older workflow linters may not understand native `parallel`; GitHub execution must verify those groups.
4. Run the affected checks and inspect the resulting Actions run. Preserve matrix coverage, build dependencies, artifact paths, and release gates.
5. Refresh this guide when workflows, action references, or parallel groups change.

Use workflow concurrency to cancel superseded check runs where appropriate. Deployment and release cancellation have different consequences: preserve the workflow’s existing policy rather than copying check-run settings blindly. Repository permissions and job-level overrides are defined in the linked YAML files.

## Bun tooling

Bun 1.4.4 provides native formatting and type checking. CI runs
`bun run format:check` and `bun run typecheck`; Biome is no longer installed.
Semantic lint rules previously supplied by Biome are not part of Bun formatting.
Retain tests, declaration generation, package validation, and audit gates.

Frozen dependency installation uses `bun ci`. Vitest and declaration emitters
remain where they provide existing coverage and published package artifacts.

## Check and build order

Local `check:source` uses Bun’s parallel script runner for formatting, project
checking, and tests. GitHub keeps these as independent parallel steps so failures
remain visible. Builds and package checks wait for the source checks.
Standalone `build` runs Bun checking first. After an explicit successful checker,
CI uses `build:artifacts`; its TypeScript step emits declarations with `--noCheck`
and does not provide a second semantic check.

## Text-lockfile cache key

The setup action now hashes the committed `bun.lock` with GitHub’s `hashFiles`.
It no longer shells out to hash files or falls back to the old binary `bun.lockb`
format. Cache restoration still precedes `bun ci`; it never replaces frozen
installation. The new key format can cause a one-time cold cache.
