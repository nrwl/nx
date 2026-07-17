# TUI Development & Testing Guide

Hard-won knowledge for working on the terminal UI. The TUI is unusual code:
it renders 60 times a second, shares a parser between threads, and its bugs
are often invisible in unit tests but obvious on a real terminal. This guide
covers how to build, test, and debug it without rediscovering the traps.

## Building and running

- **One-time setup:** link the local `nx` package so your builds are what
  the CLI runs — see `packages/CLAUDE.md` (initial `nx build nx`, then
  `pnpm link ./packages/nx`).
- **`nx build nx` is required for the running `nx` to reflect native
  changes.** `nx build-native nx` alone compiles the Rust but the CLI
  won't pick it up.
- **The native-file cache is size-keyed.** A rebuilt `.node` with the same
  byte size as the previous build loads the _stale_ artifact. When verifying
  Rust changes at runtime, always run with:

  ```bash
  NX_SKIP_NATIVE_FILE_CACHE=true NX_DAEMON=false nx <command>
  ```

- `NX_TUI=true` forces the TUI on; `--tui-auto-exit false` keeps it open
  after the run finishes so you can inspect/search the completed output.

## Driving the real TUI (the tmux recipe)

Unit tests can't catch everything — several real bugs (highlight drift on
live streaming output, resize repaint stalls) only reproduced against a live
PTY. The reliable way to test interactively without a human:

```bash
# Run a task in a dedicated tmux pane
tmux send-keys -t <pane> 'NX_TUI=true nx run <task> --tui-auto-exit false' Enter

# Drive keys (e.g. open a search and navigate)
tmux send-keys -t <pane> '/'; tmux send-keys -t <pane> 'error'
tmux send-keys -t <pane> Enter; tmux send-keys -t <pane> 'n'

# Inspect: plain text
tmux capture-pane -t <pane> -p
# Inspect: WITH ANSI escapes (styles!) — this is how you verify highlights
tmux capture-pane -t <pane> -e -p
```

In the `-e` capture, parse SGR sequences to locate styling: search matches
are reverse-video (`\e[7m`), the current match is the warning background
(`\e[48;5;3m`) with black foreground. Asserting "the highlight run spells
the query" against the parsed capture is the ground truth for alignment.

For temporary instrumentation, gate debug writes behind an env var and log
to a file (`std::fs::OpenOptions` append to `/tmp/...`), rebuild, drive via
tmux, read the file. Remove the instrumentation before committing.

## The Rust test suite

```bash
cargo test -p nx native::tui          # the whole TUI suite
cargo insta test -p nx --accept -- status_bar   # accept snapshot updates
```

- Snapshots live in `components/snapshots/` (insta). Review `.snap.new`
  content before accepting; delete orphaned snapshots when renaming tests.
- **Render-path tests beat math tests.** Render through the real
  `StatefulWidget` into a `ratatui::buffer::Buffer` and assert on cells —
  this exercises borders, padding, ANSI, wrapping, and scroll offsets that
  pure-function tests skip.
- **Marker-row snapshots** make style assertions reviewable: alongside each
  text row, emit a row of `#`/`*` markers for styled cells. Drift shows up
  as a visibly shifted marker in the snapshot diff.
- **Beware masking.** Repetitive content hides positional bugs: with every
  line starting `[INFO]`, a highlight shifted one row down lands on the next
  line's `INFO` and "spells the query" anyway. Use unique markers per line
  when asserting positions.
- **Mutation-check regression tests.** Before trusting a new regression
  test, revert the fix and confirm the test fails. Several plausible tests
  written during development passed against the buggy code.

## Coordinate systems — the one big trap

There are two ways to count visual rows, and they are NOT interchangeable:

1. **The grid basis** — `get_total_content_rows()` =
   `scrollback.len() + rows.len()` on the vt100 grid. This is what the
   renderer (tui-term `PseudoTerminal`) actually draws, and the basis for
   scroll offsets and overlay positioning.
2. **Re-wrapped logical lines** — `all_contents()` joins wrapped grid rows
   into logical lines, then code re-wraps them with `wrap_ansi`.

These diverge on real output. `Row::write_contents` in the vt100 fork trims
trailing blank cells, and `\r`/clear-to-EOL progress output (Maven, npm,
cargo) leaves wrapped rows with trailing blanks — so the reconstructed
logical line is shorter than the grid's real layout and re-wrapping
undercounts rows. The error accumulates over hundreds of lines and shifts
anything positioned in the wrong basis (this was the search-highlight-drift
bug, invisible until ~1000 lines of narrow cursor-heavy output).

**Rule: anything that maps onto rendered cells must be computed in the grid
basis.** To get grid-exact positions for the full content, re-parse
`all_contents_formatted()` into a fresh `Parser::new(total_rows, cols, 0)` —
zero scrollback makes every grid row directly addressable, and the layout
matches the render by construction (~1–2 ms at the scrollback cap; fine when
gated behind a change check).

Related capacity limits, both relevant to tests:

- `SCROLLBACK_SIZE` (1000) evicts whole **visual rows**, so a wrapped
  logical line can be chopped mid-wrap at the top of the scrollback.
- `MAX_RAW_OUTPUT_BYTES` (5 MB) compaction replays the formatted screen into
  a fresh parser — `raw_output` **shrinks**, so nothing may assume its
  length is monotonic (it only ever *changes* per write).

## Locking discipline (the render thread must never wait)

The parser is `Arc<RwLock<Parser>>` (parking_lot: non-reentrant,
writer-preferring), shared with the PTY reader thread that writes incoming
output.

- **Read everything you need BEFORE taking the screen guard.** Taking a
  second `read()` while holding `get_screen()`'s guard deadlocks the render
  thread the moment the writer queues a `write()` (this froze the whole TUI
  once).
- **Per-frame checks must use `try_read` with a cached fallback.** A
  blocking `read()` on the render thread serializes repainting behind the
  output writer and the async-resize swap — measured as visible resize lag.
  Failing toward "use last frame's value" is always safe; failing toward
  "wait" never is.
- `resize_async` updates the cached `dimensions` immediately but swaps the
  reparsed parser in later on a background thread — the cache and
  `screen().size()` disagree during that window. Code that positions against
  rendered content must read the width from the screen it is rendering, not
  the cache (`set_cached_dimensions_for_test` exists to force this
  divergence in tests).

## Performance debugging

Measure before optimizing — two real examples where the intuitive suspect
was innocent:

- The grid re-parse was suspected of causing resize lag; instrumentation
  showed ~0.5–1.8 ms per content change (~3/sec while streaming). The actual
  stall was a per-frame blocking `read()`.
- Frame-time probes (log draws over a threshold) during tmux-driven resizes
  showed 12–21 ms full-redraw spikes occur **with or without** the feature
  under suspicion — i.e. pre-existing, not a regression.

Recipe: env-gated timing writes to a `/tmp` log, `nx build nx`, drive the
scenario via tmux, compare with the feature disabled. Delete the probes
afterwards (`rg 'NX_.*_DEBUG|/tmp/nx_' packages/nx/src` should be empty).

## The vt100 fork

Terminal parsing uses `vt100-ctt` (a pinned-rev git fork). Facts confirmed
against its source that TUI code relies on:

- `all_contents()` joins wrapped rows (no `\n` between them) and trims
  trailing blank cells per row.
- `get_total_content_rows()` is literally `scrollback.len() + rows.len()`.
- `all_contents_formatted()` reproduces the exact visual layout when re-fed
  to a parser at the same width — this is what makes the tall re-parse
  grid-exact.
- Only *visible* rows are addressable (`rows()`, `row_wrapped()`);
  scrollback rows have no public per-row access — exposing an `all_rows()`
  iterator upstream is the known cleaner alternative to the re-parse.

## Component conventions

- Widgets render per-frame from props derived from the canonical `TuiState`
  — components must not keep mirror copies of run state (drift class the
  status bar work eliminated). Persistent widget state (e.g. a click-target
  `LinkRegistry`) belongs in `StatefulWidget::State`, owned by the `App`.
- UI that appears in more than one place gets ONE implementation: the task
  filter and pane search share `search_filter.rs` (input row, confirmed
  display, and the key bindings via `interpret_session_key`) so they cannot
  drift apart. Follow that pattern for any future shared idiom.
- Emoji in the status bar: prefer text-presentation glyphs; if forcing emoji
  presentation with VS16, ratatui counts the sequence two cells wide, so
  layout math stays consistent — but terminal-side rendering still varies,
  so keep adjacent spacing tolerant of a one-cell difference.
