# Commit Bloat Watcher

[![CI](https://github.com/RookiePlayers/commit-bloat-watcher/actions/workflows/ci.yml/badge.svg)](https://github.com/RookiePlayers/commit-bloat-watcher/actions/workflows/ci.yml)

Opinionated CLI that keeps commits small by inspecting your working tree and warning (or guiding you) when too many files or lines are staged. Use it from the terminal or wire it into a Husky hook so your team ships reviewable commits instead of mega-diffs.

## Features

- Counts staged and unstaged changes vs `HEAD` using `git diff --numstat`.
- Fails fast when configurable file/line thresholds are exceeded.
- Optional interactive mode that walks you through bucketing changes into multiple commits.
- `--quiet` flag for pre-commit hooks so the tool only exits with a status code.

## Installation

```bash
npm install --save-dev commit-bloat-watcher
# or globally
npm install --global commit-bloat-watcher
```

You can also run it with `npx`:

```bash
npx commit-bloat-watcher --maxFiles 12 --maxLines 1000
```

## CLI

```
Usage: commit-bloat-watcher [options]

Options:
  --maxFiles <n>   Max number of changed files allowed per commit (default: 10)
  --maxLines <n>   Max number of changed lines (added + deleted). Use 0 to disable the line limit (default: 1000)
  --interactive    When limits are exceeded, start an interactive bucketing session (default: false)
  --quiet          Suppress informational logging. Useful in Git hooks (default: false)
```

### Example

```bash
# Fail when more than 8 files or 500 lines change. Fall back to interactive bucketing.
npx commit-bloat-watcher --maxFiles 8 --maxLines 500 --interactive
```

If the limits are exceeded you can opt into the guided flow, stage files bucket-by-bucket, and supply commit messages for each chunk.

### Git Hooks

When using Husky you can add a guard in `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"
npx commit-bloat-watcher --maxFiles 12 --maxLines 800 --quiet
```

Exit codes are non-zero when the limits are exceeded, so your hook/CI job will fail automatically.

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

- `npm test` runs the Vitest unit tests for the core diff parsing helpers.
- `npm run build` bundles the CLI via `tsup`.
- `npm run lint` ensures TypeScript sources pass ESLint.

## License

ISC © RookiePlayers
