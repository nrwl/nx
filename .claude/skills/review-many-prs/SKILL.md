---
name: review-many-prs
description: >-
  Fan `/review-pr` out over several nrwl/nx PRs at once. Each PR gets its own Claude Code
  instance in its own herdr tab in the current workspace, with at most three reviewing at
  a time. A slot is held from launch until that child parks at review-pr's Step 8.5 grill —
  at which point the expensive work is done and the findings are waiting for you. Requires
  HERDR_ENV=1. Use when the user passes more than one PR link/number to review, or says
  "review these PRs", "batch review", "review-many-prs".
allowed-tools: Bash(npx tsx .claude/skills/review-many-prs/scripts/*), Bash(herdr *), Bash(gh pr view *), Bash(gh auth status*), Bash(cat *), Bash(ls *), Bash(column *), Bash(printf *), Read, Grep, Glob
argument-hint: '<pr-url|#N|N> ... [--concurrency N] [--dry-run]'
---

# review-many-prs

The batch driver both `/review-pr` and `/review-pending-pr-reviews` already assume exists.
It owns scheduling only: every actual review is a real `/review-pr` run in its own Claude
Code session, so the review criteria live in exactly one place.

**Everything below is done by `scripts/review-many-prs.ts`** (run with `tsx`, the repo's
convention for scripts). Do not reimplement the loop
in the session — a batch runs for hours (~250k tokens and ~25+ min per PR), and an LLM
sitting in a poll loop costs tokens it does not need to spend and dies at a session limit.

## Preconditions

```bash
test "${HERDR_ENV:-}" = 1
```

Failing that, stop and say so. This driver creates herdr tabs; there is no fallback.

## Run it

A batch outlives a foreground call, so give the driver its own tab:

```bash
herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label review-many-prs --no-focus
herdr pane run <root_pane_id> "npx tsx .claude/skills/review-many-prs/scripts/review-many-prs.ts 36815 36806 36789"
```

Read the pane id from `.result.root_pane.pane_id`. Report that pane id to the user, then get
out of the way — do not poll it. If no `review watch` is running yet, start ONE and leave it
running for the session; do not start another per batch.

For a quick sanity check first, `--dry-run` resolves heads and prints the plan without
launching anything.

Arguments are PR URLs, `#36815`, or bare numbers, in any mix. A non-`nrwl/nx` URL is a hard
error: `/review-pr` only reviews that repo.

The pool and the argument parser have unit tests:

```bash
npx tsx .claude/skills/review-many-prs/scripts/review-many-prs.spec.ts
```

## What a slot means

A slot is held from `herdr agent start` until the child has produced a draft at
`$TRIAGE_DIR/<PR>.md`. That is review-pr's Step 8 output, written immediately before
the Step 8.5 grill — the moment the agents have finished, the sandbox work is done,
and the findings are waiting on you.

Slots are a `SlotPool`: `acquire()` returns a promise that resolves with a slot once
one of the N is free, and a freed permit is handed straight to the longest-waiting
caller rather than round-tripping through a counter, so acquisition is FIFO. Each PR
is one `reviewOne` task; all of them start at once and block on `acquire()`, which is
what bounds concurrency.

**Releasing is one-way, structurally.** `reviewOne` releases its slot in a `finally`,
by which point it has returned and nothing is left watching the child. So when you
answer the grill and the child goes back to `working`, there is no code path that
could reclaim the slot — the expensive part is already spent, and the remaining turns
only edit a draft that is already on disk.

A permission prompt is the opposite case and **keeps** its slot: no draft exists, so
no review has happened yet, and `watch` simply has not resolved.

## How children are watched

By blocking on herdr, not polling it. Each running child gets a background waiter:

```bash
herdr agent prompt "pr-$N" "/review-pr $N" --wait --timeout "$SETTLE_TIMEOUT_MS"
```

`--wait` is atomic submit-and-wait — it matches "the first matching state observed
**after** submission". That property is essential, and plain `herdr agent wait` does
not have it. Two races were measured on this machine (2026-08-28):

- **`agent wait` right after `agent prompt` returns in 0 s** reporting the _stale_
  pre-prompt `idle`. Every child would be classified settled-with-no-draft the
  instant it launched.
- **`agent wait --until working` can miss the transition entirely.** If the agent has
  already passed through `working`, it blocks until timeout instead of returning.

So `--wait` opens the watch, and plain `agent wait` is only used afterwards, where the
state being waited for is genuinely in the future.

Each `herdr` call is an `execFile` wrapped in a promise, so "wait for this child" is a
plain `await` and "whichever settles first" needs no scheduler of its own. A `setInterval`
ticker covers only what herdr cannot signal — disk pressure, and a child wedged on
secreq's out-of-band gh consent, which reads as `working` forever and so produces no
lifecycle event at all.

Every herdr wait is bounded. This process does not own the herdr process it is blocked
on, so an unbounded wait would outlive the driver as an orphan; on timeout the loop
re-classifies, which is self-healing.

herdr reports errors as JSON on **stderr** with exit 1, so the wrapper parses stdout
_or_ stderr and a vanished agent resolves to `gone` rather than an empty string.

### Why the draft, and not `blocked`

herdr classifies terminal UI, so it can see _that_ an agent wants input — never _what
for_. Two consequences, both verified here:

- **`blocked` fires early.** Claude Code's own permission dialogs are `blocked` too. A
  child that asks to run something 30 seconds in would surrender its slot having done
  no work.
- **`blocked` also misses.** `gh` here is shimmed through `secreq`, whose consent is
  out-of-band (a prompt window / linked device, see `secreq pending`), not a TTY
  prompt. A child stalled awaiting gh approval reads as `working`.

So the draft on disk is authoritative and herdr state only corroborates it:

| herdr state                            | draft written? | driver does                                                     |
| -------------------------------------- | -------------- | --------------------------------------------------------------- |
| settled (`blocked`/`idle`/`done`/gone) | yes            | release slot → `awaiting-grill`, **permanently**                |
| `blocked`                              | no             | **hold** slot, print `NEEDS INPUT`; resume on `--until working` |
| `idle` / `done` / gone                 | no             | **only past the startup floor** → `failed`, ready to re-run     |

The `idle`-with-no-draft row is load-bearing: a review can die mid-run (session limit)
and review-pr writes **no partial draft**, so without it the scheduler waits on a corpse.
The record still exists in that case — `review stage` created it at launch — and moves to
`status: failed`, so a death is visible to `review watch` rather than being an absence.

### The startup floor

A child that has not reached `working` yet produces the same herdr output as one that
died, so the `failed` rows above are wrong for the first minute of a child's life. Two
batches were lost to exactly that: 2026-08-31 killed 3/3 on a transient `gone` reached
through the `agent_prompt_stalled` check, and 2026-08-28 killed 2/2 on a transient
`idle`. No smarter reading of the status field separates the two cases — only elapsed
time does.

So a terminal-looking status is believed only once `startupGrace` returns 0, which
happens when either the child has been observed `working` at least once, or
`MIN_RUN_SECS` (90) has passed since `agent start`. The deadline is absolute rather
than a retry budget, so it can never re-arm and a flapping status cannot spin. Being
seen `working` is the stronger of the two conditions and is what covers a cold boot
that outlasts the floor.

`blocked` is deliberately NOT gated: a permission dialog during startup is real and
does need answering. It only gains the child's age in the log line, so it reads as a
startup prompt rather than as the grill.

The draft is matched on **mtime newer than launch**, not `head_sha`: the author can push
between the driver's triage read and the child's own Step 2, and a sha comparison would
then hold the slot forever. The strict `head_sha` test stays in the pre-flight skip, where
staleness is the actual question.

## Parked children still hold a sandbox

Releasing the slot frees CPU, not disk. `review-pr` keeps its sandbox alive _through_ the grill
on purpose — Step 8.5 answers "is this pre-existing?" by reading `--ref base`, and only Step 9
destroys it. So each parked child pins a sandbox until you finish with its tab.

That pin is far cheaper than it used to be. All the children share one host container and one
repo inside it, so a parked review holds its own subtree (~0.5 GB: two worktrees plus the part
of `node_modules` that cannot be hardlinked) rather than a container of its own (~4.9 GB). The
batch's fixed cost — the ~2.3 GB copy-up of the pnpm store out of the image layer — is paid by
whichever review starts first and by no one after it.

The driver measures free space on whatever backs the container store (on this Mac that is the
Lima VM's disk, not the host's) and refuses to launch a review that would eat into
`DISK_RESERVE_GB`, projecting the next sandbox's cost from what the live ones actually consumed.
It says so and keeps going with what is running rather than failing the batch. Note that
projection now reads a _marginal_ review, not a whole container, so the first review of a cold
host is the expensive outlier rather than the typical case.

What the sharing costs: the host's `--memory`/`--cpus`/`--pids-limit` are one budget for the
whole batch instead of one per child, so a runaway test in one PR can starve its siblings.

## Records, and the one watcher

Scheduling state is not a file of its own. Every scheduled PR gets a record through
`.claude/tools/review`, the same markdown-with-frontmatter drafts `/review-pr` already
writes, with a `status:` carried through the whole lifecycle:

```
queued -> running -> needs-input | throttled -> awaiting-grill -> posted | discarded
                                                              \-> failed
```

`review stage` creates one at launch and **never overwrites an existing draft**, so
re-running over a PR that already has a review leaves it alone. `review set` edits only
the frontmatter, because `/review-pr`'s Step 8 rewrites the body wholesale and anything
else here would be lost on the next attempt. That is also why `status:` is part of
review-pr's frontmatter contract rather than something this driver bolts on.

**Watch once, not per batch:**

```bash
.claude/tools/review watch          # one line per transition, for every batch
```

One long-lived `review watch` covers batches that do not exist yet, which is the point.
It snapshots existing records at startup and does **not** replay them, so a previous
round's draft cannot be reported as a fresh result — the failure mode every hand-rolled
per-batch watcher reproduced, most often by treating "mtime within the last N minutes"
as "new". Pass `--replay` when you deliberately want the current state emitted.

`review list --pending` is the queue. A record is
live until `status:` reaches `posted` or `discarded`, which `/review-pending-pr-reviews`
sets when it posts.

## Afterwards

The driver prints a summary. For each parked PR:

```bash
herdr agent focus pr-36815     # jump into that child and answer its grill
```

Grill it there, close the tab, then post through `/review-pending-pr-reviews` — which is the
gate that reaches GitHub. Nothing in this pipeline posts anything.

Re-running the driver over the same PRs is safe: anything already reviewed at the current head
by the current `PIPELINE_VERSION` is skipped without spending a tab, and a `failed` draft never
blocks a retry.

## Configuration

Environment, all optional: `CONCURRENCY` (3), `TRIAGE_DIR` (`~/.nx-pr-reviews`; note the `review`
CLI reads the same directory as `REVIEW_DIR`, and the `triage` tool uses `TRIAGE_DIR` for something
else entirely — set them deliberately), `NX_REPO_PATH`
(`~/repos/nx`), `TICK_SECS` (30), `SETTLE_TIMEOUT_MS` (1 h), `RESUME_TIMEOUT_MS` (24 h — how long a
permission prompt may sit unanswered while holding its slot), `DISK_RESERVE_GB` (12),
`SEED_SANDBOX_GB` (6), `PRUNE_AT_END` (1), `MIN_RUN_SECS` (90 — the startup floor below
which a settled-looking child is re-checked instead of failed).

`REVIEW_NONINTERACTIVE` is deliberately **not** set by default: setting it makes children skip the
grill and run to completion, which gives up the slot model's handoff — the parking _is_ how the
findings reach you. Set it only when nobody can answer a grill (a cron run, or an operator away from
the machine), and read the resulting drafts knowing Step 8.5 never filtered their pre-existing
findings. The driver forwards it to each child's pane at `tab create`, since a fresh pane inherits
nothing from the driver's own environment.

`PIPELINE_VERSION` is read out of `review-pr/SKILL.md` at startup rather than duplicated here, so
bumping it there cannot silently desync the skip logic.

## Pre-flight happens once, on the host

`gh auth status`, `sandbox doctor`, and `tools/review-sandbox/build-image.sh` run once before the
first child. BuildKit would dedupe concurrent builds anyway, but doing it up front means three
children don't all sit through a cold image build — a stale image has cost ~25 min of package
downloads per review.

Heads are resolved with one `gh pr view` per PR, which also drops drafts, closed PRs, and
already-reviewed heads before they cost a tab. Each of those is a `secreq` consent prompt, so
expect a short burst of approvals at the start of a batch.
