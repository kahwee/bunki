# Build performance

The artifact build runs its existing tools under Bun 1.4.4. This changes the build
host, while preserving the package's exports and output formats. Tests and
coverage retain their existing runtime; source checks still finish before builds.

On the Linux x64 executor (Node v26.11.1, Bun 1.4.4), the median artifact-build time
changed from **2.517s to 1.770s**, a **29.7% reduction** for this phase.

| Build host             | Median |        Range |
| ---------------------- | -----: | -----------: |
| Node tool shebangs     | 2.517s | 1.794–2.669s |
| Bun-hosted build tools | 1.770s | 1.598–1.847s |

Both cases used the same updated dependencies and included declaration emission.
One warm-up per case preceded three alternating measured runs. All emitted files,
including declarations and source maps, had identical SHA-256 fingerprints across
the measured cases. Dependency and OS caches were warm. No other build or test
workload ran during this comparison. This excludes dependency installation, source
checks, tests, Storybook, and CI setup; it is not a whole-CI speedup measurement.

[Raw samples](benchmarks/build-runtime-2026-10-22.json) retain the baseline commit,
tool versions, individual timings, file counts, fingerprints, and candidate command.
The recorded commands refer to the baseline scripts before explicit Bun invocations
were added. Current package scripts select the measured Bun-hosted path directly.

To time the current build, install pinned dependencies with `bun ci`, finish the
source checks, then run `bun run build:artifacts` repeatedly on an otherwise idle machine.
Compare medians and emitted files; do not combine this phase result with historical
checker improvements to claim a multiplied whole-build gain.
