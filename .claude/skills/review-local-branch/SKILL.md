---
name: review-local-branch
description: >-
  Deep code review of the branch you are standing on, before it becomes a PR. Scope is
  merge-base..working-tree, so it covers commits, staged and unstaged changes together. Runs the
  same review lanes as review-pr — implementation, verification, approach, security — against the
  local checkout through the sandbox CLI, and saves a draft to ~/.nx-branch-reviews/<branch>.md.
  Use when asked to review "this branch", "my changes", or work that is not yet on GitHub.
allowed-tools: Bash(.claude/tools/sandbox *), Bash(git -C *), Bash(git rev-parse *), Bash(git merge-base *), Bash(git diff *), Bash(git status *), Bash(git log *), Bash(git fetch *), Bash(git symbolic-ref *), Bash(mkdir -p *), Bash(rm -f /tmp/branch-*), Bash(mv /tmp/*), Bash(ls *), Bash(printf *), Bash(date *), Bash(test *), Bash(echo *), Bash(head *), Bash(tail *), Bash(cat *), Bash(grep *), Bash(wc *), Bash(sed *), Write(~/.nx-branch-reviews/**), Write(/tmp/**), Edit(~/.nx-branch-reviews/**), Edit(/tmp/**), Read, Grep, Glob, Skill, Agent
argument-hint: '[--base <rev>] [--level quick|standard|deep] [--agents a,b,c]'
---

# Review the local branch (review-local-branch)

The sibling of `review-pr`, for work that has not become a PR yet. Same agents, same proof-of-work contract, same calibrations — the only real differences are how scope is discovered and that the code is yours.

**Drafts only.** This skill never commits, never pushes, never edits your working tree.

## Trust model — what the sandbox is and is not here

`review-pr` puts an untrusted PR in a container because the code is a stranger's. Here the code is **yours**, already on your disk, and there is nothing to isolate it from. Be honest about that rather than implying a boundary that does not exist:

- `sandbox start --local` registers your checkout with **no isolation**. `sandbox doctor` will say so.
- What it still buys is **uniformity**: the agents speak only the CLI, so the same definitions work in both skills with no transport branch and no fallback path to fall down.
- What it also buys is a **guardrail on your branch**. A local sandbox is `exec=screened`: commands that obviously write — `git checkout`, `rm`, `pnpm install`, `>` redirects — are rejected, so a review cannot mutate the thing it was asked to review. It is a guardrail, not a security boundary.
- `sandbox worktree` still works. It cuts a peer worktree **outside the repo**, under `~/.nx-sandboxes/worktrees/<id>-<agent>`, so an agent proving a test can fail never touches your files or your branch — the only thing it writes into your repo is the `.git/worktrees` registration, which `sandbox stop` removes.
- That worktree carries your **uncommitted work**, not just the last commit. `git worktree add … HEAD` would check out the committed state, which is not what is under review here; the CLI applies `git diff HEAD` on top so the tree matches the diff the agents were given. Untracked files stay out, exactly as they do from the diff.
- It is installed on creation, which on this repo is minutes rather than seconds. That cost is why agents are told to reach for one only when static reading genuinely cannot settle the question — not as a matter of course.

If you want an agent to run the repo's own build or test commands, start with `--allow-exec` and say so in the charter. No screen can contain those anyway — `node -e` is arbitrary code by construction.

## Step 1: Establish scope

```bash
ROOT=$(git rev-parse --show-toplevel)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SLUG=$(printf '%s' "$BRANCH" | sed 's#[/ ]#-#g')

# Refresh the base so "is this net-new?" is answered against the real master,
# not a fork point that is weeks stale.
git fetch -q origin master

BASE=${ARG_BASE:-$(git merge-base origin/master HEAD)}
test -n "$BASE" || { echo "FATAL: no merge base with origin/master"; exit 1; }
```

`--base <rev>` overrides. Use it when the branch is stacked on another branch rather than on master — a merge-base against `origin/master` would then pull the parent branch's work into scope and the review would spend itself on code you did not write.

**Refuse to run on the default branch.** If `$BRANCH` is `master`, there is no branch to review: `merge-base origin/master HEAD` is `HEAD`, the diff is empty, and every agent gets an empty scope. Say so and stop.

```bash
# Everything you would push: commits + staged + unstaged, in one surface.
git diff "$BASE" > /tmp/branch-$SLUG.diff.tmp \
  || { echo "FATAL: git diff failed"; exit 1; }
test -s /tmp/branch-$SLUG.diff.tmp \
  || { echo "FATAL: empty diff — nothing to review against $BASE"; exit 1; }
mv /tmp/branch-$SLUG.diff.tmp /tmp/branch-$SLUG.diff

git diff --name-only "$BASE" > /tmp/branch-$SLUG.files

# `|| true` is required, not defensive: grep exits 1 when nothing matches, so on a
# clean tree this pipeline fails, and under `set -e` in bash it aborts the block
# before the sandbox is ever started. Verified — zsh does not abort here and bash
# does, so the failure only shows up in some shells.
{ git status --porcelain | grep '^??' | sed 's/^?? //' || true; } > /tmp/branch-$SLUG.untracked
```

Write-then-verify-then-move, for the same reason `review-pr` does it: a bare `>` truncates the target before `git` runs, so a failure leaves a 0-byte file that every agent is then told is the complete diff.

**`git diff $BASE` is deliberately two-dot-with-working-tree.** It compares the base commit against your _working tree_, which is what "everything I would push" means — commits, staged, and unstaged together. Do not "fix" it to `$BASE...HEAD`: that drops staged and unstaged work, which on a branch mid-edit is usually the part most worth reviewing.

**Untracked files cannot appear in a diff.** A new file that was never `git add`ed is invisible to `git diff` at any syntax, and mutating the index to make it visible is not this skill's business. So they are collected separately and reported:

- If `/tmp/branch-$SLUG.untracked` is non-empty, list those paths in the draft under `## Not reviewed` and say plainly that no agent saw them. A new file is exactly where a whole unreviewed feature hides, so this warning is load-bearing rather than a formality.
- Ignore the usual noise (`node_modules`, `dist`, `.nx`) — they are gitignored and will not appear here anyway.

## Step 2: Start the sandbox

```bash
SANDBOX=$(.claude/tools/sandbox start --local "$ROOT" --base "$BASE" | head -1)

# Read-only view for the lanes that must not run anything.
READONLY_SANDBOX=$(.claude/tools/sandbox view "$SANDBOX" --exec none | head -1)
```

`--base "$BASE"` is what makes `sandbox read <id> <path> --ref base` work: it resolves to `git show $BASE:<path>` in your own checkout, so "was this already true before my branch?" is answerable with no second worktree and no second clone.

## Step 3: Write the charter

Same shape as `review-pr` Step 5, minus everything the agents already carry. Write it to `/tmp/branch-$SLUG.review-charter.md`:

```markdown
# Review charter

## Toolchain

This is the maintainer's own checkout, already installed. Do not install anything.

If a check must mutate source, run `sandbox worktree <SANDBOX> <your-agent-name> head`. It cuts a
peer worktree outside the repo that already carries the uncommitted work under review, so you may
mutate it freely. Never edit the checkout itself — it is the maintainer's live branch.

## What is under review

Branch `<BRANCH>`, diffed against `<BASE>` (<SHORT_SHA>, <SUBJECT>). The diff covers committed,
staged and unstaged changes together — this is everything that would be pushed.

<IF untracked files exist:> <N> untracked files are NOT in the diff and are NOT under review:
<list them>. Do not report findings about them; do not assume they are absent from the design.

## The problem being solved

<OMIT unless the user stated one, or a linked ticket/issue is known. Do not invent one from the
diff — a review that infers intent from the change cannot then judge the change against it.>

## Orientation — where this change sits

<Same rules as review-pr: call sites and base behavior in, rationale and conclusions out. Keep it to
~15 lines. Use `sandbox grep <SANDBOX> <symbol> packages` for call sites and
`sandbox read <SANDBOX> <path> --ref base` for base behavior.>

## What to report

Report **critical** and **important** findings, plus **strengths**. Concrete, actionable
nice-to-haves may go in a terse **Suggestions** list. When you endorse a debatable design decision,
say so in a **Maintainer calls** line rather than folding it into an endorsement.

Your own definition carries the calibrations that bind your dimension, and the proof-of-work
contract. Both still apply.
```

**This is pre-PR review, so the bar moves one notch toward candor.** In `review-pr` a rework request costs a contributor a round-trip, which is why its agents are told to endorse when torn. Here the author is the person reading the draft, and nothing has been published yet — a `BETTER_ALTERNATIVE_EXISTS` costs a rebase, not someone's afternoon. Say this in the charter so `alternative-approach` calibrates to it.

## Step 4: Dispatch

Levels are cumulative. Default is `standard`.

| Level                  | Adds                                                                             | Total |
| ---------------------- | -------------------------------------------------------------------------------- | ----- |
| `quick`                | `implementation-reviewer`                                                        | 1     |
| `standard` _(default)_ | `verification-reviewer`, `alternative-approach`, `security-reviewer`             | 4     |
| `deep`                 | `comment-analyzer`, `docs-reviewer`, `performance-analyzer`, `security-analyzer` | 8     |

`--agents a,b,c` selects explicitly and ignores levels entirely.

`deep` adds the four single-dimension specialists. They overlap the lanes by design — a lane covers that dimension in one pass among several, and the specialist gives it a whole pass. Reach for `deep` on a change that is dense in one of those dimensions, not as a default.

`reproduce-verifier` is not in any level. It needs a linked issue with a runnable reproduction, which a local branch usually has not got. Add it with `--agents` when the branch does fix a filed issue, and pass the issue number in its prompt.

Dispatch each with the prompt shape from `review-pr` Step 5, changing only the inputs:

```
Agent(
  subagent_type="<AGENT>",
  description="<AGENT> review of branch <BRANCH>",
  prompt="""
Review the local branch <BRANCH>.

SCOPE — review exactly these changes. Do NOT run `git status` or `git diff` to discover scope:
the diff below is authoritative and already covers commits, staged and unstaged work.

- REVIEW TARGET: /tmp/branch-<SLUG>.diff  (host file — read it with `Read`; this is what you review)
- CHANGED FILES: /tmp/branch-<SLUG>.files  (host file — one path per line; `Read` it)
- SANDBOX: <SANDBOX>  (the checkout under review; reach it only with `.claude/tools/sandbox`)
- BASE_REF: <BASE>  (read base state with `sandbox read <SANDBOX> <path> --ref base`)

Read /tmp/branch-<SLUG>.review-charter.md (host file) FIRST. It carries this run's scope, what is
NOT under review, and orientation around the diff. Your own definition carries the reading protocol
and the calibrations.

REQUIRED — open your report with the three proof-of-work lines your definition specifies, with
/tmp/branch-<SLUG>.diff as the file the line number refers to. A report without a verifying pair is
discarded and the agent recorded as failed — including one that found no issues.
"""
)
```

Give `$READONLY_SANDBOX` to `alternative-approach`, `comment-analyzer`, `docs-reviewer`, `performance-analyzer` and `security-analyzer` — all read-only analysts. Give `$SANDBOX` to the lanes that may need to run a check.

## Step 5: Verify each agent actually reviewed something

**Use `review-pr`'s verification block exactly** — the section "Verify each agent actually reviewed something", including the single-`verdict` shell gate, with `/tmp/branch-$SLUG.diff` as `<EVIDENCE_FILE>` and `/tmp/branch-$SLUG.line` / `.evidence` as the `Write`-tool scratch files.

Do not re-derive that block here. Every element in it closes a specific hole that a real review of this pipeline actually hit — the integer gate in front of `sed` alone has stopped host RCE three separate times — and a second copy of security-critical shell is a second copy to keep correct. Read it, don't reimplement it.

The retry rule carries over unchanged: on a failure, re-dispatch **once**, demanding a line in the far half of the file, and never paste diff content into the retry prompt.

## Step 6: Trim and write the draft

Apply the same trim as `review-pr` Step 7: drop anything matching the **Nx-specific calibration** list, keep critical and important, fold endorsements into Strengths.

Write to `$TRIAGE_DIR/<SLUG>.md`, default `~/.nx-branch-reviews` — outside the repo, so `git clean` never touches drafts and the history survives a rebase.

```markdown
---
branch: <BRANCH>
base: <BASE>
head: <HEAD_SHA>
dirty: <true if staged or unstaged changes were included>
level: <quick|standard|deep|explicit>
agents_run: <comma-separated>
pipeline_version: 8
reviewed_at: <ISO8601>
verdict: <clean|concerns|failed>
---
```

`dirty: true` matters on re-review: unlike a PR head SHA, a dirty tree has no stable identity, so a draft against one can never be deduped. Always re-review a dirty branch rather than reporting `ALREADY_REVIEWED`.

Sections: `## Summary`, `## Critical`, `## Important`, `## Strengths`, `## Suggestions`, `## Maintainer calls`, `## Not reviewed` (untracked files), `## Failures` (agents whose EVIDENCE never verified).

## Step 7: Clean up, then offer the rest

```bash
.claude/tools/sandbox stop "$SANDBOX"    # also drops the read-only view
```

Then **name the agents that did not run** and offer to dispatch them against the same diff:

> Ran: implementation, verification, approach, security (`standard`).
> Not run: comment-analyzer, docs-reviewer, performance-analyzer, security-analyzer. Want any?

A top-up merges into the existing draft rather than replacing it — the frontmatter records `agents_run`, so a later pass appends its findings and extends that list. Restarting from scratch would re-pay for every lane that already reported.

## What this skill deliberately does not do

- **No close-without-merge check.** Supersession and abandonment are PR concepts; there is no PR.
- **No Polygraph session check.** That step exists to explain why a _contributor_ did something. You are the author.
- **No `gh` calls at all.** Nothing here is on GitHub yet, which is the point.
