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

## Updating the Baseline

After making performance improvements, update the golden numbers:

```bash
pnpm bench:update-baseline
```

Then commit `benchmarks/baseline.json`.

## Benchmarks

| Benchmark | What it measures |
|---|---|
| `version` | CLI startup time (`nx --version`) |
| `show-projects` | Project graph query speed |
| `lint-warm` | 1110 cached lint tasks (flat, no deps) |
| `build-warm` | 1110 cached build tasks (topological, 3 levels) — disabled |

## Regression Detection

The `bench` target compares results against `baseline.json` and exits non-zero if any benchmark is >20% slower than the baseline.
