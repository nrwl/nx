---
name: review-pending-pr-reviews
description: Review, grill, edit, and post pending PR review drafts saved by /review-pr (or its batch/cron runners). Lists drafts that have not yet been posted, walks the maintainer through each finding, then posts, closes, or discards. Use when the user says "post my pending reviews", "what reviews are waiting", "go through the review outbox", or invokes /review-pending-pr-reviews.
allowed-tools: Bash(gh pr review *), Bash(gh pr view *), Bash(gh pr comment *), Bash(gh pr close *), Bash(ls ~/.nx-pr-reviews*), Bash(ls $TRIAGE_DIR*), Bash(git -C ~/.nx-pr-reviews *), Bash(git -C $TRIAGE_DIR *), Bash(open *), Bash(cat > /tmp/gh-pr-review*), Bash(cat > /tmp/gh-pr-close*), Read, Edit(~/.nx-pr-reviews/*), Write(~/.nx-pr-reviews/*), Write(/tmp/gh-pr-review*), Write(/tmp/gh-pr-close*), Grep, Glob, Skill
---

# Review Pending PR Reviews

The outbox for `/review-pr`. Nothing reaches GitHub until the maintainer approves it here.

This skill is where a **human is guaranteed to be present**. `/review-pr` runs headless most of the
time — `review-prs` drives it across tmux panes, and a cron runs it overnight — so its own Step 8.5
grill is skipped on the majority of reviews. This skill is therefore the real evaluation gate: it
grills the findings first (Step 3) and only then offers to post.

## Configuration

- `TRIAGE_DIR` — where drafts live. Default: **`~/.nx-pr-reviews`**, matching `/review-pr`'s own
  default. Override with the same value if the maintainer has repointed it.

**Do not read `~/.claude/triage/prs/`.** That is the store of the retired `review-pr-deep` pipeline.
Its drafts predate the current review criteria (pre-`PIPELINE_VERSION` tiers), so posting one would
publish findings the current calibrations would have dropped. If the maintainer wants those, they
must be re-reviewed by `/review-pr`, not posted from the old store.

Each draft has YAML frontmatter (`pr`, `verdict`, `head_sha`, `pipeline_version`, `posted_at`, ...)
and a `## Review draft` section holding the body that will be posted.

A draft is **pending** iff `posted_at:` is empty. Once posted or discarded, `posted_at` is set and
the file is kept as the historical record — it feeds `/review-pr`'s re-review dedup, so never delete
one.

## 1. Find pending drafts

```bash
ls $TRIAGE_DIR
```

Read each file's frontmatter; pending iff `posted_at:` is empty. Sort oldest-first by
`last_reviewed_at` so the longest-waiting review goes first.

For each, display: PR number and title, `verdict`, `attempt`, `last_reviewed_at`, URL, and the first
3 lines of `## Review draft`.

## 2. Check for drift before presenting

```bash
gh pr view PR_NUMBER --repo nrwl/nx --json headRefOid,state,isDraft -q '{head: .headRefOid, state: .state, isDraft: .isDraft}'
```

IMPORTANT: every Bash command must be a single, standalone command. Do not chain with `&&`, `||`, or
`;`, and do not append redirects or backgrounding — these break permission matching. Use separate
Bash calls.

Flag before the action prompt:

- **Stale** — current head differs from frontmatter `head_sha`. Recommend `skip` and re-running
  `/review-pr PR_NUMBER`.
- **Closed/merged** — `state != OPEN`. Recommend `discard`.
- **Draft PR** — `isDraft == true`. The maintainer may not want to post yet.
- **Old pipeline** — `pipeline_version` is missing or below `/review-pr`'s current constant. The
  draft was produced by weaker criteria. Recommend `skip` + re-review rather than posting.

## 3. Grill the findings before offering to post

**Do this before showing the action prompt, and only for drafts that survived Step 2.** Skip it
entirely when the draft's frontmatter shows a `## Grill` section already — `/review-pr` Step 8.5
grilled it interactively and re-grilling wastes the maintainer's time. Say so and go to Step 4.

**Brief the maintainer before the first question — it is not optional, and it matters more here than
in `/review-pr`.** That skill's grill follows a review the maintainer just watched run; this one
opens on a draft a cron produced days ago, about a PR they have likely never opened. Asking "does
this hold?" cold makes the question unanswerable, and silence is defined below as _stop_ — so a cold
grill yields no evaluation at all, on the very drafts this skill calls the real gate.

```text
PR #<N>: <title> — <author>, <age>, reviewed <date> at <head_sha>
<one or two sentences: what the PR actually changes, in plain terms>

Draft verdict: <verdict> — <what drives it>

Critical (<n>) — these gate the verdict
  1. <file:line> — <the claim in one clause>

Important (<n>)
  2. <file:line> — <the claim in one clause>

Pre-existing (<n>), Suggestions (<n>) — not grilled, listed so you know they exist
```

One line per finding. The detail arrives with the question that needs it, and every question
restates its own finding inline — the claim, its `NET-NEW` line, its `TRIGGER` line, and one sentence
on what specifically is uncertain about it. Never refer to a finding by number alone, and never make
the maintainer open the draft to answer.

Invoke `/grill-me`, scoped to findings rather than to a plan. It works in **rounds over a frontier** —
round 1 is every Critical finding, round 2 is Important plus whatever round 1 unblocked, round 3 is
the consequences. Skip Suggestions; they never move the verdict.

For each finding, state your recommendation up front, then ask the three questions the tiers turn on:

1. **Does it hold?** Is the defect real as described, not merely plausible?
2. **Is it this PR's?** Does the `NET-NEW` line's base evidence support it, or is it pre-existing /
   `widens`?
3. **Is the tier right?** Critical = something the PR produces is wrong _now_. Important = wrong
   _later_, or left unguarded.

Skip any question the draft already answers. The goal is resolving genuine uncertainty, not making
the maintainer re-read their own review.

**Never answer your own questions.** If a question goes unanswered, stop and leave the draft exactly
as it is. A grill that supplies the maintainer's answers launders agent output into apparent human
review — which is precisely what this skill exists to prevent.

**The sandbox is long gone by now.** Unlike `/review-pr` Step 8.5, this skill cannot re-read
`--ref base` to settle a factual dispute — the checkout was destroyed when that review finished. If a
round turns on a fact rather than a judgment, say so and recommend `skip` + a fresh `/review-pr` run
rather than guessing. Do not drop a finding on an unverified hunch.

Apply each round's answers before asking the next — drop, re-tier, or keep — then **recompute the verdict** with
`/review-pr` Step 7's rule: **only Critical blocks**, at any quantity. Dropping the last Critical
moves a PR from `needs-changes` to `lgtm`.

**When the frontier is empty, brief again** — the same inventory the grill opened with, re-rendered
against the post-grill draft, showing what moved rather than only where it landed:

```text
Grill complete — PR #<N>

Verdict: <before> → <after>          (or "unchanged: <verdict>")

Dropped (<n>)
  <file:line> — <claim, one clause> — <the maintainer's reason, in their words>
Re-tiered (<n>)
  <file:line> — <claim, one clause> — critical→important: <reason>
Kept (<n>)
  <file:line> — <claim, one clause>
```

The maintainer answered one round at a time, against one finding at a time; nobody holds the
cumulative effect of six answers in their head. Ask whether it matches what they decided, and fix it
here if not — this is the last point before Step 4 offers to post it to a public PR.

**This is a confirmation, not another round.** Do not reopen a settled finding or raise a concern the
grill did not. If the maintainer's reply opens something genuinely new, grill it as a new round.

Record every drop and re-tier under `## Grill` in the draft file, one line each:

```markdown
## Grill

- <file:line> — <finding, one clause> — DROPPED: <maintainer's reason, in their words>
- <file:line> — <finding, one clause> — RETIERED critical→important: <reason>
```

That section is the tuning data for `/review-pr`'s criteria. A reason that recurs across PRs is a
missing calibration — add it to that skill's "Nx-specific calibration" list instead of re-litigating
it every review.

## 4. Present for review

Open the PR alongside the draft:

```bash
gh pr view PR_NUMBER --repo nrwl/nx --web
```

```
## Pending PR Review: #PR_NUMBER — TITLE
**Verdict:** needs-changes          ← post-grill verdict; note it if the grill changed it
**Attempt:** 1
**HEAD:** 438fa5a1 (stored) — 438fa5a1 (current)  ← or ⚠ DRIFT if different
**State:** OPEN (draft)
**Reviewed:** 2026-04-24

### Summary
<First Summary paragraph from the Review draft — 2-5 lines.>

### Counts
Critical: N · Important: N · Suggestions: N        (after the grill)
Dropped in grill: N

---
<first ~15 lines of the Review draft>
... (full body is in $TRIAGE_DIR/PR_NUMBER.md)
---

Actions: [post] [edit] [skip] [discard] [open-file]
```

**If `verdict: superseded`** — posting a review on a dead PR is noise. The draft already names the
superseding PR in its `### Close-without-merge check` section.

```
Actions: [close-with-pointer] [edit] [skip] [discard] [open-file]
```

**If `verdict: unnecessary`** — the PR shouldn't merge but there's no specific replacement to point
at (no real bug / abandoned / duplicate of rejected work).

```
Actions: [close-with-reason] [edit] [skip] [discard] [open-file]
```

Wait for the maintainer to choose an action for each draft.

## 5. Actions

- **post** — Post to GitHub. Extract ONLY the `## Review draft` body (from the first `###` under it
  through the last line before `## Prior reviews`); never the frontmatter, `## Grill`, or trailing
  sections.

  Verdict → `gh pr review` flag:
  - `lgtm` / `approve` → `--approve`
  - `needs-changes` → `--request-changes`
  - `blocked` / `comment` / anything else → `--comment`
  - `superseded` / `unnecessary` do NOT use `post` — see the close flows below.

  Always use `--body-file` to avoid shell quoting issues:

  ```bash
  cat > /tmp/gh-pr-review-PR_NUMBER.md << 'REVIEW_EOF'
  REVIEW_BODY
  REVIEW_EOF
  ```

  ```bash
  gh pr review PR_NUMBER --repo nrwl/nx --request-changes --body-file /tmp/gh-pr-review-PR_NUMBER.md
  ```

  Then update frontmatter with Edit: `posted_at: <ISO-8601 local timestamp>`, `posted_url: <URL>`.
  Append to `## Posted`: `- attempt N posted YYYY-MM-DD as <verdict> → <posted_url>`. Commit
  (see below). Never delete the file.

- **close-with-pointer** (only for `superseded`) — Close with a short comment pointing at the
  superseding work. Do NOT post a review.
  1. Extract the superseding PR number(s) from `### Close-without-merge check`. Prompt if unclear.
  2. Draft a short comment, let the maintainer edit before posting:
     ```
     Thanks for the PR! This has been superseded by #<SUPERSEDING_PR>, which <one-line reason>. Closing this one — appreciate the work.
     ```
  3. `gh pr comment` with `--body-file`.
  4. `gh pr close <NUMBER> --repo nrwl/nx`.
  5. Frontmatter: `posted_at: <timestamp> (closed as superseded)`, `posted_url: <comment URL>`.
  6. `## Posted`: `- attempt N closed-as-superseded YYYY-MM-DD → <comment_url>`. Commit.

- **close-with-reason** (only for `unnecessary`) — Close with a short comment explaining why, with no
  specific replacement. Do NOT post a review.
  1. Extract the reason and evidence from `### Close-without-merge check` (which signals fired,
     linked issue with no thumbs-up, last activity date, prior closed PR number).
  2. Draft a short, kind comment tailored to the reason. **Always** show it for edit before posting —
     these need a human touch. Templates by primary reason:
     - **Bug not reproduced:**
       ```
       Thanks for the PR! Before reviewing in depth, we tried to reproduce the issue from #<ISSUE> on master and weren't able to — the behavior described doesn't appear to be a bug we can confirm. Could you share a minimal repro repo so we can verify there's something to fix here? In the meantime I'm closing this; happy to reopen once we can confirm the underlying issue. Appreciate the contribution.
       ```
     - **Abandoned (stale + conflicted + unanswered):**
       ```
       Thanks for the PR! This branch has been inactive for <N> months and now has merge conflicts plus open reviewer questions. Closing for now to keep the queue tidy — please feel free to reopen with a rebase and answers to the prior review when you're able. Appreciate the work.
       ```
     - **Duplicate of recently-closed PR:**
       ```
       Thanks for the PR! This looks similar in scope to #<PRIOR_CLOSED_PR>, which we closed previously — the same concerns likely apply here. Closing to avoid re-litigating; if you think the situation has changed, the best next step is a comment on #<PRIOR_CLOSED_PR> or a fresh issue laying out the new context. Appreciate the contribution.
       ```
     - **Other / mixed:** one paragraph pulling the strongest signal(s). Always thank the contributor.

  3. Stage via `--body-file`:
     ```bash
     cat > /tmp/gh-pr-close-PR_NUMBER.md << 'CLOSE_EOF'
     <comment body>
     CLOSE_EOF
     ```
  4. `gh pr comment <NUMBER> --repo nrwl/nx --body-file /tmp/gh-pr-close-PR_NUMBER.md`
  5. `gh pr close <NUMBER> --repo nrwl/nx`
  6. Frontmatter: `posted_at: <timestamp> (closed as unnecessary)`, `posted_url: <comment URL>`.
  7. `## Posted`: `- attempt N closed-as-unnecessary YYYY-MM-DD → <comment_url>`. Commit.

  **Be cautious.** Closing without a pointer feels worse to a contributor than "superseded by". If
  the maintainer is unsure, prefer `skip`, or fall back to `post` with `--comment` so the contributor
  can respond before the PR is closed.

- **edit** — Modify the `## Review draft` body in place via Edit, then show it again for approval.

- **skip** — Leave it pending. Move on. Right answer for stale drafts and old `pipeline_version`.

- **discard** — Set `posted_at: <timestamp> (discarded)`. Append to `## Posted`:
  `- attempt N discarded YYYY-MM-DD (<reason>)`. Never delete the file. Commit.

- **open-file** — `open $TRIAGE_DIR/PR_NUMBER.md`, then re-prompt for an action.

- **post all** — Post every remaining pending draft, mapping each verdict to its flag. **Grill each
  one first** (Step 3) unless it already carries a `## Grill` section — `post all` is a shortcut past
  the action prompt, not past the evaluation. Update each file, commit once, show a summary. Skip
  `superseded` and `unnecessary` drafts (they need per-PR comments) and list them at the end.

## Commit after changes

Only when `TRIAGE_DIR` is actually a git repo and the file is not ignored — same guard as
`/review-pr` Step 10. The default `~/.nx-pr-reviews` is typically **not** a repo, in which case the
file on disk is the record and this step is a silent no-op:

```bash
git -C $TRIAGE_DIR rev-parse --is-inside-work-tree
```

```bash
git -C $TRIAGE_DIR add PR_NUMBER.md
```

```bash
git -C $TRIAGE_DIR commit -m "triage: posted review for PR #PR_NUMBER"
```

Use `discarded` for discards; `triage: update pending PR reviews (posted/discarded)` for `post all`.

## 6. Summary

```
## PR Review Queue Complete
- Posted: X reviews
- Skipped: X drafts (still pending)
- Discarded: X drafts
- Findings dropped in grill: X across Y drafts
- Remaining: X drafts in $TRIAGE_DIR
```

## Empty queue

If every file has a non-empty `posted_at`: **"No pending PR reviews to post. The outbox is empty."**
