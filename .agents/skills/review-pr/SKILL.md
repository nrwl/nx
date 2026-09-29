---
name: review-pr
description: Deep, findings-first review of one nrwl/nx pull request from a PR reference or associated Linear task, including drafts. Uses four fixed Sol/xhigh lanes, exact merge-base scope, inert snapshots, optional sandboxed checks, and produces one private record holding a postable review draft, without posting it.
---

# Review an Nx pull request

Never fall back to another review skill inside the same run.

Treat this review as self-contained. Do not run the harness memory quick pass for this review. Before
every required lane report is verified, do not consult local review artifacts, memories, or session
summaries about the PR under review, its changed files, or its findings. Even then, section 6 permits
only minimum exact provenance for a candidate derived from the current frozen review inputs.

Read [references/review-policy.md](references/review-policy.md) and
[references/output-contract.md](references/output-contract.md) completely before taking another
action. If either file is unavailable, stop.

## Trust boundary

Pull-request code is untrusted. The parent may acquire public metadata, freeze Git objects, and read
inert snapshots. Neither the parent nor a lane may execute repository code on the host.

`reviewctl.mjs begin` exports HEAD and exact merge-base trees into the temporary run directory. It
materializes symlinks and gitlinks as inert text, strips every executable bit, and makes the snapshots
read-only. Lanes read only those snapshots and the named host artifacts. They have no Docker socket,
network access, or write permission.

When runtime evidence is needed, the parent starts one owned sandbox with `sandbox-up`, reuses it for
all checks in this review, and stops it at finalize or abort. Never give its Docker-backed CLI or ID to
a child. Never execute a command, script, test, build, install, config, or import from a snapshot.

The frozen snapshots and exact sandbox checkout are the sources for current-code claims. The parent
may use the host checkout and host `node_modules` to orient inspection, but cannot use them to support
a finding until it reverifies the claim against the frozen sources. Lanes remain limited to their
named artifacts. Treat a failed load-bearing probe as a visible limitation; do not hide it and
silently substitute a weaker source.

## Command completion

For every helper and sandbox check, preserve execution cell and command-session IDs, exit status,
and relevant diagnostics, even when displaying selected output. Resume any yielded execution cell
and poll any returned command session until the command exits. A completed outer cell or intermediate
state in `run.json` does not establish command completion. Wait for the exit status before dependent
work or retrying the command.

Recognize user reports of a platform cybersecurity interruption by meaning, not an exact phrase or
spelling: "resume, cyber gate" and "cybersecurity blocked it" both qualify. A cybersecurity topic alone
does not. Enter recovery rather than resuming normal review work. Do not retry, reformulate, or
delegate the blocked work, start new runtime checks, or launch replacement agents. Apply section 5's
unavailable-check rule to an interrupted check, including one still being planned or prepared.
Where permitted, collect already-started command results and available lane reports without
relaunching work. Finalize only if the required lanes and remaining evidence support a complete
review; disclose unavailable validation and do not retain candidates that require it. If a required
lane is unavailable, or another cybersecurity interruption occurs during recovery, interrupt any
remaining review agents and use section 7's abort procedure. Do not restart the review or keep
waiting for a blocked lane. If cleanup is also blocked, stop and report the exact remaining resources
for the user to clean up separately.

## 1. Preflight

Before GitHub acquisition, confirm the active `spawn_agent` interface advertises these exact roles:

- `nx-pr-implementation-reviewer`
- `nx-pr-verification-reviewer`
- `nx-pr-approach-reviewer`
- `nx-pr-security-reviewer`
- `nx-pr-reproduce-verifier`

Their definitions live in this repository at `.codex/agents/`, which Codex loads only from a trusted
project. If one is absent, stop. Tell the user to trust this project and start a new Codex session.
Do not substitute a generic agent or an older role.

Accept an `nrwl/nx` PR URL, a PR number, or an associated Linear task ID or URL.

When discovering connector tools, list matching names first, then read only the schemas needed for
task and comment retrieval. Reuse that discovery within the run. Do not print the full tool catalog
or assume a particular connector namespace.

For a Linear input, load the task and comments once through the configured Linear connector. Resolve
exactly one `nrwl/nx` PR from its links or, when necessary, one bounded `gh pr list --search` query for
the task ID. Ask the user when zero or several plausible PRs remain. Do not guess.

For a PR input, resolve it directly. Draft status never stops an explicitly requested review.

## 2. Freeze scope and context

Run the helper from the repository root. Every command below names its path from there:

```bash
node .agents/skills/review-pr/scripts/reviewctl.mjs begin --pr <PR_NUMBER_OR_URL>
```

If the `begin` execution handle is no longer available, inspect
`$TMPDIR/nx-codex-pr-review/pr-<PR>-*/run.json` and adopt an
existing `begun` run only when its PR number, live HEAD SHA, and pipeline match the current request and
it has no charter, lane report, or `abort-reason.md`. Run `begin` again only when none of those
recovery steps yields the run.

If the user explicitly asks to re-review an unchanged PR or bypass an existing result, append
`--force`. Otherwise, `begin` returns the existing verdict and artifact paths when a completed review
matches the current head, base, merge base, and pipeline version. Return those paths and stop; failed
or incomplete attempts never suppress a review.

`PIPELINE_VERSION` in `reviewctl.mjs` is the review-criteria generation that dedup compares. Bump it
whenever the policy, the lane set, or the admission rules change materially, so drafts produced under
weaker criteria stop suppressing a re-review.

Run it with the required GitHub network escalation. The command writes only under the system
temporary directory. It:

- validates `gh` authentication;
- acquires PR metadata, full diff, changed-file records, commit messages, and linked public issues
  once;
- resolves `compare/<base>...<head>.merge_base_commit.sha` on the host;
- fetches the PR head and exact merge-base SHA into a temporary bare repository;
- exports inert HEAD and base snapshots;
- writes `run.json` and prints the exact artifact paths.

Never replace the merge-base SHA with the live base-branch tip, `pulls/<n>.base.sha`, or an in-sandbox
`git merge-base`. The shallow sandbox cannot reconstruct the merge base.

Do not fetch PR comments or reviews. The PR body and public issue material already acquired by `begin`
are the public conversation input for a first review.

Extract every associated Linear ID from `run.json`. Load each task and its comments once if the
connector is available. Write their complete chronological context to the run's named
`private-context.md` file using a literal file-writing tool, never shell interpolation. If Linear is
unavailable for a PR input, continue and record the limitation. If Linear was the only input and could
not be resolved, stop and ask for the PR.

Use private task material as follows:

- give lanes only a sanitized problem statement, reproduction facts, and exact acceptance criteria;
- keep author conclusions, maintainer decisions, and prior review discussion out of the charter and
  out of parent analysis until every required lane report is verified;
- never quote, paraphrase, attribute, or allude to private content in the review draft;
- never treat a private assertion as proof that current code works.

## 2a. Check whether the PR should close without merge

Before writing the charter, evaluate whether current public evidence makes the requested code review
unnecessary. Bias every judgment toward the contributor: ambiguity means the signal did not fire.
Draft PRs never trigger this early exit. `--force` bypasses it, but supported evidence may still inform
final adjudication.

Reuse the acquired metadata and public grounding:

- A conflict (`mergeable == CONFLICTING` or `mergeStateStatus == DIRTY`) is advisory alone.
- A linked issue closed as `COMPLETED` by work other than this PR is strong supersession evidence.
- A linked issue closed as `NOT_PLANNED` is strong unnecessary evidence when its public discussion
  applies to this PR's scope.
- When a linked issue remains open, inspect each other PR in `closedByPullRequestsReferences` with
  `gh pr view <NUMBER> --repo nrwl/nx --json state,mergedAt,title,url`. Exclude the PR under review.
  Another merged PR is a supersession candidate. Exit only when its merged code and public issue
  history show that it fully subsumes this PR; an open or reopened issue makes that bar harder to
  clear. Read a credible candidate with `gh pr diff <NUMBER> --repo nrwl/nx`; the reference alone is
  not enough.
- No linked GitHub issue or resolved Linear task, no substantive motivation, and either more than 100
  changed lines or a changed public export surface is advisory speculative scope, never an early exit.

Without `--force`, a strong result skips the charter, reviewers, runtime checks, and adjudication.
Draft the normal final envelope with zero findings and a concise `### Close without merge` section
that links the decisive public evidence, then finalize. The helper derives the closeability path from
the absence of reviewer attempts; the model cannot select it. A closeability-only artifact never
suppresses a later full review at the same head. If no strong signal fires, emit no section and
continue normally.

## 3. Write the charter

Read the full diff, changed-file list, public grounding, and the smallest surrounding HEAD/base source
needed to orient the lanes. Read `pr.diff` in non-overlapping chunks, delivering each large chunk in a
separate tool response without other artifact output. Printing multiple chunks in one outer execution
response can still truncate, even when each nested command succeeds. Recover missing ranges without restarting or skipping required
content. Narrow exploratory searches to relevant paths before printing matches. Read `metadata.json`
only when a named field is needed. Create the named `charter.md` in the run directory with:

1. PR number, title, URL, head SHA, base branch, and exact merge-base SHA.
2. The public or sanitized private problem statement.
3. An acceptance catalog with stable IDs only when an allowed source names the exact supported input
   or configuration and the exact outcome. Only a labeled catalog entry may appear in a finding's
   `ACCEPTANCE` field. Record each source kind. For public prose, include the verbatim source sentence;
   for a pre-existing test, cite the exact assertion. For private material, include only the sanitized
   acceptance and its source kind. Keep broad claims, implementation descriptions, explicit
   limitations, non-goals, and conflicts visible as unlabeled context; they cannot support
   `claimed-fix` admission. A narrow limitation scopes a broad summary.
4. A neutral orientation of changed symbols, callers, entry points, gates, base behavior, and package
   boundaries. Keep it concise and factual. Do not include the author's rationale or the parent's
   conclusions.
5. Any one-time measured fact that several lanes would otherwise re-derive. Record the method and both
   sides. Invite lanes to challenge it.
6. Known execution limitations.

Do not paste the full diff, file list, prior reviews, or raw Linear comments into the charter. The
dispatch names those artifacts by path.

## 4. Dispatch the fixed wave

Spawn the implementation, verification, approach, and security roles concurrently. Use
`fork_turns: "none"` for every reviewer child in this workflow, including the conditional reproduce
verifier, so it receives only its role instructions and dispatch. Resolve every dispatched input to
an absolute path; do not rely on inherited conversation or working-directory context.

Each dispatch names these exact inputs:

```text
PR_NUMBER: <number>
DIFF: <run>/pr.diff
CHANGED_FILES: <run>/files.txt
HEAD_SNAPSHOT: <run>/head
BASE_SNAPSHOT: <run>/base
HEAD_SYMLINKS: <run>/head-symlinks.json
BASE_SYMLINKS: <run>/base-symlinks.json
CHARTER: <run>/charter.md
POLICY: <skill>/references/review-policy.md
```

State that `DIFF` is the authoritative scope, snapshots are inert reading surfaces, and the lane must
not enumerate the run directory, discover scope from host git, call GitHub or a tracker, execute code,
or invoke another review skill. Ask the parent for a missing fact.

Give every lane the full diff on every review. Do not carry prior conclusions or findings into its
initial dispatch or any later turn.

When each lane completes, write its response verbatim to `<RUN_DIR>/<LANE>-report.md` with a literal
file-writing tool. Verify it:

```bash
node .agents/skills/review-pr/scripts/reviewctl.mjs verify-evidence --run <RUN_DIR> --lane <LANE> --report <REPORT_FILE>
```

The helper checks only that the lane cited a real line from the frozen diff and used its required
verdict token. It does not validate or accept findings.

On failure, send the same lane one correction request. Tell it to reread the diff, fix the evidence
preamble or envelope, and return the complete report again. Do not paste a valid evidence line into
the retry. If the retry fails, abort the review. This abort rule applies only to the four fixed lanes;
a missing fixed lane is not a clean result.

## 5. Decide runtime checks and reproduction

After the fixed wave, identify checks whose result could change a finding or verdict. Also run Vale
when changed documentation is covered by the repository's Vale configuration, as POLICY requires.
The parent owns execution. A lane may explain an uncertainty but cannot execute or authorize a command.

The parent may download a version-pinned third-party package archive for static inspection. Store
and extract it under `<RUN_DIR>/scratch/`, and read it only. Never execute it, install it into either
snapshot, or add it to the sandbox under review.

When a deciding candidate depends on added or changed executable shell control flow, run the exact
shipped bytes with only the minimum safe inputs needed to decide it. Use honest and negative cases.
For a shell-grammar or argument-boundary claim, decide it by comparing the command string the shipped
block constructs against the argv required by the accepted endpoint, and never pass that constructed
string to a shell. Use an input that attempts secondary-command execution only when that execution is
the unresolved endpoint of an admitted security finding. A clean-room rewrite is not evidence about
the shipped block.

Before spawning `nx-pr-reproduce-verifier`, name the current candidate, the exact proposition, and the
finding retention, tier, or verdict decision the result could change. Confirm from the frozen inputs
that the planned observation can run. Use the same setup and observation on base and HEAD when both
expose the endpoint. A HEAD-only check may qualify when the accepted endpoint has no comparable base
surface, independent admission evidence establishes the required HEAD behavior, and the observation
can decide whether HEAD meets it. It cannot establish base attribution. Otherwise, do not spawn it. If
the review policy requires an unavailable check, do not retain the candidate; record the limitation or
unresolved question. A refusal to plan or run a check makes it unavailable. Do not retry or reformulate
it, and run no further dynamic checks in this invocation. General compatibility confidence, exploratory
matrices, and coverage suggestions do not qualify. Give a qualifying reproduction the frozen
artifacts, sanitized grounding, and exact proposition. It plans one safe paired comparison or
qualifying HEAD-only check; it does not execute it.

Start the shared sandbox when a deciding check or a required Vale run exists:

```bash
node .agents/skills/review-pr/scripts/reviewctl.mjs sandbox-up --run <RUN_DIR>
```

This command sweeps abandoned review state, builds the pinned image, checks Docker capacity, claims one
review checkout of the exact HEAD and merge base, and installs HEAD once. Reviews share one container
per image and one Git object store inside it; this review owns its own worktrees under that container,
not the container. Run it with the required Docker escalation. A capacity or setup failure makes that
check unavailable; it does not invalidate the static lanes. Use `blocked` only when the unavailable
result is required for a safe verdict.

For Vale, read the frozen repository configuration and lint the covered changed pages at HEAD using
that configuration. Do not spawn a reproduce verifier or run a base install for this check. Record
the command, exit code, and relevant diagnostics under `checks/`. Assess diagnostics against the
changed content and policy; CI results do not replace this run. If execution is unavailable, record
the limitation and continue the documentation review.

Before running an Nx target, inspect its project configuration and task dependencies to understand
the expected fanout. Prefer a narrower command when it decides the same proposition. Do not add
`--excludeTaskDependencies` merely to force a target past required prerequisites. A failure caused by
a reduced or incomplete task graph is not PR evidence until missing prerequisites are ruled out.

For an executable check, write the reviewed script or command under `<RUN_DIR>/scratch/` with a
literal file-writing tool. Execute only fixed host argv and stream the file on stdin:

```bash
tools/review-sandbox/sandbox exec <SANDBOX> -- bash -s < <HEAD_SCRIPT>
tools/review-sandbox/sandbox exec <SANDBOX> --base -- bash -s < <BASE_SCRIPT>
```

Nothing copied from a PR, issue, lane, or model may appear in the host shell command. Use the same
script, toolchain, and observation boundary on both sides when both are reachable. Record commands,
exit codes, and bounded relevant output under the run's `checks/` directory. Do not run untrusted
external repository code in this first version.

If a reproduce verifier was used, return the observations and ask it for its final report. Verify only this
final post-observation report with `--lane reproduce`. If it still fails verification after one
correction, record the check as unavailable and continue with the four fixed lane reports; do not abort
or redispatch them.
Reproduction advice cannot introduce an unrelated finding.

If a valid base reproduction cannot confirm the reported bug, treat that as inconclusive rather than
as proof that the bug is absent. Ask the author for a runnable reproduction and use `blocked` only when
the PR body gives no root-cause rationale, no public maintainer corroboration exists, and no associated
Linear task tracks the problem. This signal never makes the PR unnecessary.

When installation succeeds only without `--frozen-lockfile`, record that limitation. Do not use the
result for a dependency-sensitive claim unless the resolved version and inspected package bytes are
identified explicitly.

Reuse the one sandbox for every check in this review. Stop it directly before pausing for a user
decision; finalize and abort also stop the exact recorded ID best-effort.

## 6. Adjudicate

Read acquired author-visible task history only after every required lane report is verified. It may
direct a current recheck, but rederive every candidate from the frozen current and base evidence.

Do not search private local review artifacts, memory, or session summaries for candidates. If exact
provenance or an earlier reviewed SHA is needed, read only the minimum relevant material. It may
confirm that a current candidate concerns the same subject or supply a locator to reverify, but it may
not enter the finding's evidence chain, introduce a candidate, or direct inspection or rechecking.
Ignore any such conclusion already present in context for discovery and disposition. Prior context
never narrows the full-diff scope. Do not compute an incremental diff for timing claims; omit timing
unless separately proven.

The parent performs one adversarial pass over every Critical and Important candidate. Apply the review
policy in full. In particular:

- independently verify the supported input, base endpoint, HEAD endpoint, changed cause, trigger,
  and consequence;
- reconcile the applicable contract against the complete PR description and acquired author-visible
  task history before deciding admission, tier, or repair. Verify author claims against current
  evidence; an explicit same-scope maintainer call remains relevant unless new public evidence
  refutes its basis;
- test the strongest contrary explanation, including pre-existing endpoint equivalence, narrower PR
  limitations, unsupported reachability, existing equivalent authority, and same-class siblings;
- reject a complete claim with any unsupported material premise;
- return a narrower plausible version of a lane-originated defect to the owning lane once instead of
  rewriting it in the parent;
- keep one root cause once while preserving distinct triggers and consequences;
- challenge false-coverage findings explicitly by restoring the claimed regression mentally or with a
  focused mutation under the policy's whole-test and evidence requirements;
- do not turn uncertainty into a finding.

### Optional Polygraph context

Only after the surviving findings are complete, use Polygraph when a finding's disposition turns on
why the author chose a behavior, scoped out an omission, deferred work to another PR, or rejected an
alternative, and the acquired public sources do not answer that question. Skip it for plain defects.
Run only:

```bash
node .agents/skills/review-pr/scripts/reviewctl.mjs polygraph-context --run <RUN_DIR>
```

Run it with the required Polygraph network escalation. Read its output file only when it reports
`available: true`. The helper checks authentication, makes one bounded search by PR number, and
writes only sessions whose pull-request URL exactly matches the frozen PR. Search provides the PR
links needed for matching and any available description; current `session show` output adds no fields,
so no per-candidate lookup is needed. A matching session may have no description. The helper uses only
read-only `whoami` and `session search` operations. Unavailable Polygraph or no exact match does not
change the review or its draft.

Treat the resulting descriptions as private, potentially stale hypotheses. Reverify every relevant
claim against the current diff and public evidence. Polygraph may only attach a maintainer
consideration to an existing finding, convert a discrepancy into a question grounded entirely in
public evidence, or leave it unchanged. It cannot add or promote a finding, change technical severity,
or move a Critical item out of the blocking set. Only current code evidence can close a finding. If
the rationale could change merge disposition, use the existing maintainer-decision stop.

Record one private line for this step: `Polygraph context: not needed`, `unavailable`, `no exact
match`, or `<N> exact matches`, followed by the disposition effect or `no change`. This trace is never
part of the review draft.

Never quote, paraphrase, attribute, or allude to Polygraph content in the review draft. If a useful
question cannot be stated from public evidence alone, keep it under `Author follow-ups (not for the
PR)` in the private review.

A candidate found by a parent-directed recheck remains parent-attributed. Do not send it through a
lane or describe it as lane-originated.

Account for every lane Finding, Pre-existing item, Suggestion, Question, Maintainer consideration,
and Dynamic evidence or reproduction nomination once. Record `keep`, `drop`, `resolved`, `merged`, or
`unavailable` with a short reason in the private review. No lane item may disappear silently. The
same disposition pass checks Suggestions against the policy's responsibility and existing-coverage
criteria. The review draft still includes only retained material allowed by the output contract.

When a finding survives contract reconciliation, conflicts with a maintainer call, and its disposition
remains unresolved, stop the sandbox. Show the user the defect, the call, its basis, the current evidence,
and your recommendation. Ask whether to accept the risk or retain the finding. Apply the answer without
changing technical severity.

## 7. Draft and finalize

Overlapping finalization for the same PR is unsupported; finish or stop the other attempt first.

Draft `<RUN_DIR>/final-result.md` using the exact envelope in `output-contract.md`. The private review
is complete and evidence-rich. The review draft is concise, contextual, free of internal mechanics,
and publishable verbatim. Never post it.

The record lands in the same directory Claude's `review-pr` skill writes, so a maintainer posts this
draft through `/review-pending-pr-reviews` exactly as they post Claude's.

Finalize by saving the record locally with the required triage-directory escalation. In the approval
request, name the resolved destination directory and explain that the helper reads GitHub and Git
metadata to recheck identity, saves local files, and cleans owned resources. It does not post to
GitHub or Linear or upload review content.

```bash
node .agents/skills/review-pr/scripts/reviewctl.mjs finalize --run <RUN_DIR> --result <FINAL_RESULT_FILE>
```

`finalize` requires all four verified lanes for a full review. A closeability-only result instead
requires strong close evidence, zero findings, and no reviewer attempts. It rechecks the live head,
base branch, and merge base, archives the prior successful record, writes the new record atomically,
then removes the run directory and exact sandbox.

If approval is denied, preserve the run and draft, stop its sandbox before waiting, and ask the user
for approval with the exact destinations and effects. Do not retry through another route or treat
the denial alone as a failed review. Abort if the user declines continuation. This does not override
the cybersecurity-interruption recovery rule.

If final-result validation or local artifact writing fails, correct the input or environment and rerun
`finalize`; the run remains intact. If identity moved or the review cannot complete, use `abort` rather
than deleting state. `begin` reclaims abandoned run directories older than 24 hours and reports each
reclaimed run. It defers stale runs that own a sandbox until the next `sandbox-up`, where Docker cleanup
already belongs.

If any required lane, frozen changeset identity, or unrecoverable mechanical boundary fails, write
the reason to `<RUN_DIR>/abort-reason.md` and run:

```bash
node .agents/skills/review-pr/scripts/reviewctl.mjs abort --run <RUN_DIR> --reason-file <REASON_FILE>
```

Run `abort` with the same triage-directory escalation required by `finalize`.

Abort writes a separate private failure record, preserves the last successful record, suppresses a
new draft, cleans owned resources, and returns failure. If the failure record cannot be written, it
stops the sandbox but retains the run directory for inspection. Never manually delete run state or a
review checkout while a helper command can identify the exact owned resource. The shared container is
never this review's to remove.

Return the record path and the verdict. State when optional context or a check was unavailable.
