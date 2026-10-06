---
name: review-many-prs
description: Review several nrwl/nx PRs with Codex, coordinating isolated reviews and saving local drafts for maintainer approval. Use when given multiple PR numbers or links to review, or asked for a batch review.
---

# Review several PRs

Read [Codex execution conventions](../codex-shared/execution.md) and [review-pr](../review-pr/SKILL.md). Each PR follows that complete review workflow; this skill only coordinates the batch. Use Codex subagents when available, with a sequential fallback. No Herdr or Claude process is required.

## Resolve the batch

Accept PR numbers, `#N`, and `https://github.com/nrwl/nx/pull/N` URLs. Reject URLs for other repositories, deduplicate numbers, and fetch each PR's title, URL, state, draft flag, and current head with `gh pr view N --repo nrwl/nx --json number,title,url,state,isDraft,headRefOid`. Skip closed/merged PRs and drafts unless the user included drafts explicitly. A dry-run request reports the resolved plan without staging or dispatching anything.

Read existing drafts in `${TRIAGE_DIR:-$HOME/.nx-pr-reviews}` before dispatch. Preserve history. Skip a completed current-head review only when its pipeline version matches the current `review-pr` contract and the user has not requested a fresh review. An old draft or an incomplete staged record is not a completed review.

## Schedule reviews

Perform shared authentication and sandbox/image preflight once, following `review-pr`. Stage each selected PR with the existing CLI (substitute metadata safely as individual arguments):

```bash
.claude/tools/review stage N --title TITLE --url URL --head SHA
.claude/tools/review set N running
```

Use at most three simultaneous PR reviews, lowered to the session's available capacity and the user's requested concurrency. Each PR review itself needs reviewer lanes; leave room for those agents or run PRs sequentially while parallelizing their lanes. Never start duplicate work for a PR already running in this session.

For each child, supply the repository root, PR number, absolute `review-pr/SKILL.md` path, draft directory, and these instructions:

> Complete `$review-pr N` through the saved draft. This is a headless batch: leave the human grill pending and return the draft path, reviewed head SHA, verdict, verification limits, and any failures. Preserve lifecycle metadata and prior review history. Never post to GitHub. Clean up your own sandbox once the draft is saved; do not prune other reviews. You share the workspace with other agents: do not revert their edits. Use the supplied review role references through native Codex delegation if capacity permits; otherwise disclose sequential role passes.

Use native completion notifications and bounded waits. A child asking for permission has not completed a review. Mark its record `needs-input` and report the exact blocker; keep track of its live work before reusing capacity. Do not retry indefinitely or claim that an idle agent completed a draft.

On completion, inspect the returned draft: it must belong to this run, contain the reviewed SHA and current pipeline version, and include the findings and verification limits. An unchanged pre-existing draft does not prove success. Mark valid drafts `awaiting-grill`; mark failed reviews `failed` with a useful note. Preserve the `status` field when the reviewer rewrites the draft. Release capacity only when the child has finished its review work or has been explicitly stopped.

```bash
.claude/tools/review set N awaiting-grill
.claude/tools/review set N failed --note REASON
.claude/tools/review list --pending
```

Use the same sequence locally if subagents are unavailable. Keep the batch in the active Codex session; do not claim it survives session termination. To resume, inspect saved drafts and lifecycle state, re-fetch PR heads, and schedule only unfinished or stale work.

## Handoff

Report each PR link, reviewed SHA, status, draft path, and verification limits. Use [review-pending-pr-reviews](../review-pending-pr-reviews/SKILL.md) to walk the maintainer through saved findings and post only approved reviews. The batch itself never posts, closes, or merges PRs.
