---
name: triage-review-pane
description: >-
  Open the triage approval TUI in a side pane next to the conversation and arm the watcher that
  reports each decision back. Use after staging records with `triage stage`, or whenever the user
  asks to review, approve or go through the triage queue. Requires herdr or tmux — say so plainly
  if neither is running rather than falling back to something worse.
allowed-tools: Bash(herdr *), Bash(tmux *), Bash(.claude/tools/triage *), Bash(.claude/skills/triage-issues/scripts/watch-triage.sh), Monitor
argument-hint: '(no args)'
---

# Open the triage review pane

Two jobs: put `triage review` where the user can act on it without losing the conversation, and arm
the watcher so their decisions come back to you as notifications instead of you polling.

## 1. Check there is anything to review

```bash
.claude/tools/triage list
```

Nothing staged means nothing to open. Say so and stop — an empty TUI is a worse answer than a
sentence.

## 2. Detect the multiplexer

```bash
echo "herdr=${HERDR_ENV:-no} tmux=${TMUX:-no}"
```

**If neither is set, stop and tell the user.** This skill only works inside herdr or tmux: a side
pane needs a multiplexer to put it in, and the TUI needs a real TTY, so there is nothing sensible to
degrade to. Say that in one line and hand over the command:

> The review TUI needs a side pane, which only works inside herdr or tmux — neither is running here.
> Run `pnpm triage-tui` yourself and I'll pick the results up from `triage feedback`.

Then arm the watcher anyway (step 4). It polls the record files, so it works regardless of how the
TUI was started, and the user still gets their decisions reported back.

Do not substitute something else. A TUI launched in the foreground takes the session over, and one
launched detached has no terminal and exits immediately.

## 3. Open the pane

**herdr:**

```bash
NEW=$(herdr pane split --current --direction right --ratio 0.45 \
      --cwd "$PWD" | sed -n 's/.*"pane_id":"\([^"]*\)".*/\1/p' | head -1)
herdr pane run "$NEW" "pnpm triage-tui; herdr pane close $NEW"
```

**tmux:**

```bash
tmux split-window -h -c "$PWD" 'pnpm triage-tui'
```

Four things that are easy to get wrong:

- **The new pane id is at `result.pane.pane_id`**, not `result.pane_id`.
- **Use `pane run`.** It honors live bracketed-paste mode and submits the text and Enter atomically.
  `pane send-text` and `pane send-keys` are low-level and non-submitting — reach for those only to
  drive a TUI that is already running.
- **The pane closes itself.** Appending `; herdr pane close $NEW` is why. Waiting on the process from
  outside means polling, and a poll that loses the race strands a dead pane for the rest of the
  session. tmux needs no equivalent — it closes a pane when its command exits.
- **Do not `--focus`.** The user is probably still reading what you just wrote, and stealing focus
  mid-sentence costs them more than the keystroke it saves.

## 4. Arm the watcher — once

**If a watcher from an earlier invocation is still running, do not arm another.** It stays armed
until the queue settles or its timeout expires, so a second one duplicates every notification and
you cannot tell which decision was real. This skill gets re-invoked often — the pane closes itself
on `q`, so reopening it is routine, and the watcher outlives the pane by design. Reopen the pane and
reuse the running watcher.

```
Monitor(command: ".claude/skills/triage-issues/scripts/watch-triage.sh",
        description: "triage review decisions",
        timeout_ms: 3600000)
```

One line per status change, including the note the reviewer typed on a `changes-requested`, then it
exits once every record settles — which ends the watch on its own. It also emits, rather than going
quiet, if the records directory disappears mid-review: `.nx-issue-triage` is gitignored and several
agent sessions share this checkout, so a stray clean really can delete a queue out from under a live
review.

Then **stop and let them work.** Do not poll `triage list`; the watcher is the point.

## 5. While they review

You can push into a running TUI:

```bash
.claude/tools/triage notify reload 36775     # restaged it — reload and jump there
.claude/tools/triage notify select 36792     # point them at one
.claude/tools/triage notify message "..."    # a line in their status bar
```

Fire-and-forget: no TUI open is a normal state, not an error, and the record on disk stays the source
of truth either way.

## 6. Apply as approvals land — do not wait for the queue

**An approval in the TUI is the go-ahead to apply that record, immediately.** That gate is the whole
point of staging; waiting for a second verbal confirmation duplicates it.

**Apply when approvals arrive, not when the queue settles.** `apply` only ever touches records the
reviewer approved, so running it early is safe by construction — and on a long sweep the alternative
is holding finished work hostage to the slowest record in the batch. A reviewer who approves ten
issues and then goes to lunch should come back to ten applied issues, not ten still waiting on the
other twenty-seven.

```bash
.claude/tools/triage apply        # applies only what they approved, however few
```

Applied records archive themselves out of the review list, so the pending count keeps shrinking and
the watcher still settles normally.

Do not batch them up "to save a call" — each apply is a handful of `gh` invocations, and the cost of
deferring is that an approval sits unapplied for as long as the review takes.

When a record comes back **changes-requested** instead, address the note and restage it (Step 5's
`notify reload`). That record is not applied until it is approved again.

```bash
.claude/tools/triage feedback     # what they asked you to change, and why
```

The watcher's last line tells you when everything has settled — at which point there should be
nothing left to apply, because you have been applying all along.
