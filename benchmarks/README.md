# Nx CLI Benchmarks

Synthetic workspace with 1110 projects arranged in a 3-level fan-out (10 groups x 10 subs x 10 leaves). Each project defines `build`, `copy`, and `cat` targets that operate on a shared `lorem.md` file — no real compilation, just enough I/O to exercise Nx's task pipeline.

## Workspace Targets

| Target    | Command                            | Cached | Outputs | Dependencies |
| --------- | ---------------------------------- | ------ | ------- | ------------ |
| **build** | `cp lorem.md → dist/output.md`     | Yes    | Yes     | `^build`     |
| **copy**  | `cp lorem.md → copy-out/output.md` | Yes    | Yes     | None         |
| **cat**   | `cat lorem.md`                     | Yes    | No      | None         |

## Quick Start

Prerequisites: [hyperfine](https://github.com/sharkdp/hyperfine) (`cargo install hyperfine`)

```bash
# Run all benchmarks and compare against goals + baseline
pnpm nx run benchmarks

# Run a single benchmark
pnpm nx bench:version benchmarks
pnpm nx bench:show-projects benchmarks
pnpm nx bench:cat-warm benchmarks
pnpm nx bench:copy-warm benchmarks
```

Each `bench:*` target depends on `^build` so the Nx packages are compiled first.

## Benchmarks

| Benchmark       | What it runs              | What it measures                                        |
| --------------- | ------------------------- | ------------------------------------------------------- |
| `version`       | `nx --version`            | CLI startup and module loading                          |
| `show-projects` | `nx show projects`        | Project graph construction via daemon                   |
| `cat-warm`      | `run-many -t cat` x1110   | Task scheduling + hashing with no output artifacts      |
| `copy-warm`     | `run-many -t copy` x1110  | Cached task execution with output tracking              |
| `build-warm`    | `run-many -t build` x1110 | Cached tasks with topological deps (currently disabled) |

All benchmarks use `NX_NO_CLOUD=true`, run `nx reset` before each iteration, and collect at least 5 runs (10 for `version`) via hyperfine.

## Goals and Baselines

Performance is tracked with two files:

- **`goals.json`** (committed) — target times the team agrees on. CI fails if a benchmark exceeds its goal.
- **`baseline.json`** (gitignored) — your local machine's numbers for personal comparison.

The `run-benchmarks.ts` script reads both and prints a table with colored deltas showing how the current run compares to each.

### Setting the Baseline

```bash
# First run auto-creates baseline.json
pnpm nx run benchmarks

# Explicitly overwrite with fresh numbers
pnpm nx run benchmarks -- --set-baseline
```

## How It Works

1. Each `bench:*` script invokes hyperfine and writes a `results-<name>.json` file.
2. The `run` target depends on all `bench:*` targets, so they execute in sequence (`parallelism: false`).
3. After all benchmarks finish, `run-benchmarks.ts` reads the result files and prints the comparison table.

## CI

Benchmarks run as part of the affected target pipeline in CI (`nx affected --targets=...bench`). The goals in `goals.json` act as the regression gate.
