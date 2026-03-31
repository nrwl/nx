# Nx CLI Benchmarks

1110 projects in a 3-level fan-out: 10 groups, each with 10 subs, each with 10 leaves.

- **build** depends on `^build` with `dependentTasksOutputFiles` — runs topologically
- **lint** has no dependencies — all tasks run in parallel

## Running Benchmarks

Install [hyperfine](https://github.com/sharkdp/hyperfine): `cargo install hyperfine`

Run all benchmarks and compare against baseline:

```bash
pnpm bench
```

Run a single benchmark:

```bash
pnpm nx bench:show-projects benchmarks
pnpm nx bench:lint-warm benchmarks
```

## Baseline

The baseline is a local-only file (`baseline.json`, gitignored) that captures your machine's numbers. When you run `pnpm bench`, the report compares your current run against both the baseline and the committed `goals.json` targets, showing colored deltas.

### Generating / Updating the Baseline

Run all benchmarks and save the results as your local baseline:

```bash
pnpm bench -- --set-baseline
```

Re-run the same command after making performance improvements to overwrite with fresh numbers.

## Benchmarks

| Benchmark       | Command               | Outputs | Dependencies | What it measures                          |
| --------------- | --------------------- | ------- | ------------ | ----------------------------------------- |
| `version`       | `nx --version`        | —       | —            | CLI startup / module loading              |
| `show-projects` | `nx show projects`    | —       | —            | Project graph query via daemon            |
| `cat-warm`      | `cat lorem.md` × 1110 | No      | Flat         | Task scheduling + hashing (no output I/O) |
| `lint-warm`     | `cp lorem.md` × 1110  | Yes     | Flat         | Cached tasks with output tracking         |
| `build-warm`    | `cp lorem.md` × 1110  | Yes     | Topological  | Cached tasks with deps (disabled)         |

## Regression Detection

The `bench` target compares results against `baseline.json` and exits non-zero if any benchmark is >20% slower than the baseline.
