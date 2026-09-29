# Review output contract

Read this file completely before adjudication or drafting. A finalized review produces one record per
pull request at `~/.nx-pr-reviews/<NUMBER>.md`. It holds the review draft a maintainer posts to
GitHub, plus the private evidence behind it. The skill never posts it.

That file is shared with Claude's `review-pr` skill and read by its `review-pending-pr-reviews`
outbox, so its layout is fixed. The outbox posts everything between `## Review draft` and
`## Prior reviews`, and treats a draft as pending while frontmatter `posted_at:` is empty. Every
private section therefore sits below `## Prior reviews`, and the draft must be publishable verbatim.

## Final result handoff

The parent writes one temporary Markdown file for `reviewctl.mjs finalize`:

```text
VERDICT: lgtm|needs-changes|blocked|superseded|unnecessary
CRITICAL: <count>
IMPORTANT: <count>
REVIEW_KIND: review|re-review
LINEAR_TARGET: <NXC-ID or none>

--- LIMITATIONS ---
<one top-level bullet per line, or none>

--- PRIVATE REVIEW ---
<complete adjudicated private review>

--- REVIEW DRAFT ---
<the publishable review body>
```

The limitations section is private. Record unavailable optional context, unavailable deciding checks,
or another material constraint. Use `none` when no limitation is known. The helper validates only the
outer envelope and mechanical publication rules. It does not decide findings.

When current public evidence establishes `superseded` or `unnecessary` before reviewer dispatch, use
zero findings and a concise `### Close without merge` section naming the decisive evidence. The
helper derives this path from the absence of reviewer attempts; the envelope cannot select it. A
forced review always requires the full reviewer wave.

## Private record

The record opens with frontmatter carrying PR identity, frozen HEAD, base branch, exact merge base,
verdict, attempt, `posted_at`, and `posted_url`. Then come `## Review draft` and `## Prior reviews`.
Below those it keeps:

- the adjudicated private review, with a compact disposition for every lane item, including dropped,
  merged, resolved, and unavailable items;
- the frozen scope and artifact hashes;
- all verified lane reports and any parent-run check results;
- public grounding and private context;
- failures and limitations.

The private review records whether optional Polygraph context was not needed, unavailable, unmatched,
or read, plus any disposition effect. This status never appears in the draft.

On a re-review the helper moves the previous draft to the top of `## Prior reviews` under
`### attempt <N-1> - head_sha=<SHA> - <DATE>`, preserves `## Author follow-ups (not for the PR)`,
`## Grill`, and `## Posted` verbatim, and copies the complete previous record to
`.history/<NUMBER>/attempt-<N-1>-<SHA>.md`. The inline entry is what the next review reads; the copy
keeps the evidence the new record replaces. `posted_at` and `posted_url` reset because the new draft
has not been posted, and the earlier posting stays recorded under `## Posted`.

When persistence succeeds, an explicit abort writes a separate failure record under
`.failures/<NUMBER>/`, including lane verification inputs not already preserved as verified reports,
and leaves the last successful record unchanged. The verification-input section is absent when no
stored input adds information beyond the verified reports.

## Review draft

The draft is posted verbatim, with no header, footer, or attribution, so it must read like a review a
maintainer wrote. Identity, verdict, HEAD, and attempt live in the record's frontmatter. Never repeat
them in the draft.

Start with a `### ` heading and use no heading above level 3 anywhere in the draft: a `##` line ends
the section the outbox extracts. Emit only the sections that apply, in this order:

1. `### Close without merge`
2. `### Since previous review` (re-review only)
3. `### Critical`
4. `### Important`
5. `### Maintainer calls`
6. `### Questions for the author`
7. `### Suggestions`
8. `### Pre-existing follow-ups`

Mark base-side finding anchors and related locations with `(base)` after the closing backtick; HEAD
locations may stay unmarked. Deleted-file locations are base-side. Never substitute a base line
number for a HEAD line.

A first review omits continuity. A re-review includes exactly one non-empty `### Since previous
review` section. Use re-review only when acquired task history contains relevant earlier review
feedback, an author response, a maintainer decision, or a linked-issue outcome. A local review record
that has no author-visible task history remains private context and does not make the draft a
re-review.

Before drafting continuity, account for every status-relevant earlier finding and response. Classify
each subject as addressed, partially addressed, acknowledged, withdrawn, or still concerning. State
an explicit fix, decline, deferral, acceptance, or challenge before the current evidence status. Do
not flatten a known response to `unresolved`.

When the prior reviewed SHA equals HEAD, no code item can be addressed or partially addressed by a
later code change. Use still concerning or withdrawn. Do not restate unchanged code as an update.

Omit timing unless it is separately proven. Every round reviews the full diff and computes no
incremental comparison, so a prior reviewed SHA alone never establishes causation. Never use
`Introduced by this update`, `newly identified`, `new finding`, or similar wording when timing is
unknown.

## Finding shape

Use `### Critical` and `### Important` exactly once when non-empty. Render each finding as:

```markdown
#### `path/to/file.ts:123`

<Supported entry point> -> <input or configuration> -> <wrong endpoint>.

<Concise explanation of the changed cause, exact attribution, and consequence. Add a trace or example only when needed.>

**Suggested fix:** <validated repair outcome>

**Why Critical:** <validated exposure, occurrence, consequence, and tier rationale>

**Maintainer consideration:** <validated unresolved disposition fact>
```

Use `Why Important` for Important findings. Omit the Maintainer consideration line when the value is
`none`. Do not expose internal labels such as `TRIGGER`, `ADMISSION`, acceptance IDs, candidate IDs,
or lane verdict tokens.

The finding prose must preserve:

- the supported or acceptance input;
- the final wrong endpoint;
- the material merge-base/HEAD attribution;
- every changed-code location material to explaining the finding;
- the concrete consequence;
- the validated repair outcome;
- the occurrence conditions and tier rationale;
- any real fact that could change merge disposition.

State prevalence only when evidenced. If prevalence could affect disposition and is unknown, say it
is unknown in the tier rationale or Maintainer consideration. Do not infer rarity from Nx generators,
repository examples, or public-code search.

List lower-severity Maintainer calls, Questions for the author, Suggestions, and Pre-existing items
when present, but keep them compact. Preface Pre-existing with one sentence saying it is follow-up
material and does not affect the verdict. A blocked draft must state the exact unresolved fact or
decision under `### Questions for the author` or `### Maintainer calls`, explaining why it prevents a
safe verdict and what answer would resolve it. Mark optional scope questions as non-blocking.

When a same-scope maintainer call is accepted as risk, acknowledge it briefly in continuity and ask
for no action. Do not retain the accepted item under a lower tier. When the call is rejected because
new public evidence refutes its basis, retain the finding and name that evidence without mentioning
internal deliberation.

## Prose rules

- Write as a collaborator describing the remaining distance to merge.
- Do not prefix findings with `Failure:`.
- Do not add a Validation, Verification, or Reproduction verification section.
- Mention validation only when the author must use a non-standard procedure to establish correctness.
- Omit generic scope summaries, strengths, process narration, draft disclaimers, internal metadata,
  raw probe flags, and schema labels. Never mention the review harness, seeded test inputs, snapshots,
  lanes, the sandbox, or private Polygraph context. When attribution matters, state base and HEAD
  behavior directly.
- Remove dead prose, repeated conclusions, generic praise, and closing text that only restates the
  reviewed HEAD.
- Keep lower-severity items shorter than Critical findings without omitting the actionable fact.

## Verdict

Apply this order:

1. Strong public proof that another merged change fully subsumes every substantive goal: `superseded`.
2. Strong public proof that the PR should not merge at all: `unnecessary`.
3. Any retained Critical finding: `needs-changes`.
4. An unresolved fact or maintainer decision necessary for a safe verdict: `blocked`. Identify the
   evidence that makes the answer necessary; uncertainty alone is insufficient. A rejected finding
   does not become a blocking question merely because its scope remains unclear. Optional scope clarification,
   unchanged base behavior without an established violated commitment, and follow-up choices do not
   block. Preserve the policy's user-decision gate for supported findings that conflict with an
   explicit maintainer call.
5. Otherwise: `lgtm`, regardless of Important count.

A required lane failure or a mechanical-boundary failure is not a completed verdict. Abort the attempt,
suppress the draft, write a separate private failure record, clean owned resources, and rerun fresh.

Strong close outcomes require current public evidence. A shared issue, overlapping file, similar title,
or conflicting branch is advisory alone and never skips the requested review.
