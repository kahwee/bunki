# Code Coverage in Bunki

This document explains how code coverage works in the Bunki project and how to use the coverage tools.

## Overview

Code coverage is a metric that helps us understand how much of our code is executed during tests. It's a valuable tool for ensuring that our tests are comprehensive and that we don't have untested code paths.

Bunki uses Bun's built-in coverage tools to generate coverage reports, and integrates with Coveralls for GitHub visualization.

## Coverage Badge

The main README includes a Coveralls badge that shows the current coverage status of the main branch. This badge updates automatically when new commits are pushed to main.

## Running Coverage Locally

You can generate and view coverage reports locally using the following commands:

```bash
# Run tests with coverage
bun test:coverage

# OR use the coverage script (which also displays a summary)
bun run coverage
```

This will generate coverage reports in the `coverage/` directory, including:

- `lcov.info`: Raw coverage data in LCOV format
- `coverage-summary.json`: JSON summary of coverage statistics
- `lcov-report/index.html`: HTML report that can be viewed in a browser

To view the HTML report, open `coverage/lcov-report/index.html` in your browser.

## Coverage in Pull Requests

When you open a pull request against the main branch, a GitHub action will automatically:

1. Run the tests with coverage
2. Post a comment on the PR with the coverage report
3. Show coverage changes compared to the base branch

This helps reviewers understand how the PR affects test coverage and highlights areas that might need additional tests.

## Coverage in CI Pipeline

The CI pipeline for the main branch includes a step to generate and upload coverage reports to Coveralls. This keeps the coverage badge up-to-date and provides a history of coverage changes over time.

## Coverage Thresholds

Currently, we aim for at least 70% code coverage across the codebase. This threshold is enforced in the PR coverage comment workflow, which will highlight if coverage drops below this level.

## Improving Coverage

If you find areas with low coverage, consider adding more tests to cover those code paths. Focus on critical functionality first, and aim to cover edge cases and error handling paths.

The coverage report will help identify which files and lines are not being tested, making it easier to target your testing efforts.

## Common Coverage Issues

- **Unreachable code**: Sometimes code appears uncovered because it's unreachable or only for edge cases
- **Error handling**: Error paths often have lower coverage since they're harder to trigger in tests
- **Platform-specific code**: Code that only runs on certain platforms may show as uncovered
- **Purely development code**: Code that only runs in development mode might be skipped in tests

## Best Practices

1. Write tests as you develop new features
2. Review coverage reports regularly
3. Focus on functional coverage, not just line coverage
4. Prioritize testing critical paths and business logic
5. Don't chase 100% coverage at the expense of valuable tests

## Additional Resources

- [Bun Test Coverage Documentation](https://bun.sh/docs/cli/test#--coverage)
- [Coveralls Documentation](https://docs.coveralls.io/)