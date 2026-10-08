# Nx pull-request review policy

Read this file completely before reviewing or adjudicating a finding.

## Review boundary

- The frozen merge-base-to-HEAD diff is the authoritative scope on every run.
- Review the full diff on a re-review. Author-visible prior review history provides continuity, not a
  narrower scope.
- Use the frozen HEAD and exact merge-base snapshots for source. Never infer scope from the host
  working tree or reconstruct a repository-wide diff.
- A lane may read only the exact artifacts and snapshot roots named in its dispatch.
- GitHub, Linear, and other context is acquired once by the parent. Lanes do not refetch it.
- Author-visible acquired task history may direct inspection after the independent lanes finish. It
  cannot be quoted publicly or serve as the only evidence for a finding.
- Private local review artifacts, memory, and session summaries may confirm that a current candidate
  concerns the same subject or supply exact provenance and locators to reverify. They may not enter a
  finding's evidence chain, direct inspection or rechecking, or introduce a candidate.
- Treat the PR title and description, issue text, tests, comments, and documentation as claims or evidence.
  Trace production behavior before accepting them.

## Required method

For every material candidate:

1. Identify the changed cause.
2. Trace a supported public entry point and concrete input through all relevant branches to the final
   user-visible or contract-visible endpoint.
3. Compare the same endpoint on the exact merge base. For transactional behavior, compare the same
   final result, durable state, and visible output. Check whether a supported same-mechanism sibling
   already reaches the failure; distinguish expanded reach from a new defect or new kind of harm.
4. Establish the occurrence conditions. Rarity does not lower severity; lack of a reachable supported
   path disqualifies the finding.
5. Inspect same-class siblings, finite variants, callers, adapters, and consumers before stopping at
   the first instance.
6. Name a focused repair outcome. Before proposing a mechanism, trace it through the original trigger,
   relevant ordering and eligibility gates, and affected output channels. If the mechanism is not
   established, retain the supported finding and describe only the required outcome.

For matching, precedence, or selection logic, trace original inputs through enumeration, filtering,
final acceptance, and the consumer. An intermediate candidate is not the selected result.

A file's presence, absence, or content, an exit code, or an output channel alone does not establish a wrong
endpoint. Name the consumer and its wrong final behavior, or the documented public contract that the
observed behavior violates. The contract must cover this exact command path and input, not a
neighboring path. Static source tracing establishes either basis. A PR's own title or description
never supplies that independent contract. When source tracing cannot decide consumer behavior, run
a focused check. Without either basis, do not retain the observation as Critical or Important.

Use a focused runtime check only when it can decide a candidate, except for the required Vale pass
on covered documentation changes. The parent executes all repository code in the owned Docker
sandbox. Lanes never execute snapshot content.

## Admission

A Critical or Important finding must include:

```text
TIER: Critical|Important
ADMISSION: base|no-base-surface|widens|claimed-fix
BASE-ENDPOINT: <final base outcome and source>
HEAD-ENDPOINT: <final HEAD outcome and source>
CHANGED-CAUSE: <changed line that causes the difference or violates the criterion>
TRIGGER: <supported entry point -> input or configuration -> user-visible failure>
FIX: <one concise public-ready repair outcome>
RISK-CONTEXT: <exposure, occurrence, consequence, and why this tier applies>
MAINTAINER-CONSIDERATION: <one unresolved disposition fact, or none>
```

Additional requirements:

- `MAINTAINER-CONSIDERATION`: do not use `none` when a valid but unusual trigger leaves product
  support, scope, or accepted risk open and that fact could change merge disposition. If the open fact
  instead controls whether the endpoint is wrong, ask a Question rather than filing the finding.
- `base`: the merge base is the deciding counterfactual and has materially better behavior.
- `no-base-surface`: name the absent base entry point and an independent public contract, repository
  invariant, protocol rule, focused check, or dominant same-surface source that establishes the
  required HEAD behavior. Changed tests, comments, and broad PR prose are insufficient alone.
- `widens`: name the same pre-existing defect, its exact old reach, and the additional HEAD reach.
- `claimed-fix`: name the exact accepted behavior that HEAD still violates and its source. Quote the
  sentence for public prose, cite the exact assertion for a pre-existing test, or cite the charter's
  sanitized acceptance and source kind for private material. The source must be linked issue or task
  acceptance, an explicit maintainer decision, a documented public contract, a pre-existing test the
  PR does not author, or a PR title or description commitment whose own words name both the exact input
  and the exact endpoint. Apply the file/consumer gate above before considering this admission. The
  trigger may mechanically elaborate a source-named input, but it may not introduce a configuration,
  lifecycle, or pre-existing-state precondition that no accepted source names. A source also does not
  establish an adjacent cleanup, durability, or compatibility guarantee unless it names that
  guarantee. A broad summary, an implementation description, or a PR-authored test is insufficient
  alone. Apply explicit scope and limitations before interpreting a broad commitment. If ambiguity
  controls whether the endpoint is wrong, resolve it from the acquired context or ask a Question;
  do not retain the stronger interpretation as a finding with a maintainer consideration. A stated
  limitation does not override an independently established public contract or erase a base
  regression. State when base already failed; do not describe that case as a regression.

If the same defect and trigger exist unchanged at the merge base, report it as Pre-existing. Do not
search for unrelated old defects. If support, reachability, correctness, attribution, or authority
remains unresolved, ask a question instead of filing a finding.

## Severity

Only Critical blocks. Important, Suggestions, Questions, Maintainer calls, and Pre-existing items do
not affect the verdict at any count. An unresolved question blocks only when its answer is necessary
to reach a safe verdict under the output contract. A rejected finding does not become a blocker just
because its scope is still unclear. Without independent evidence requiring a merge decision, an
ambiguous commitment about unchanged base behavior remains a non-blocking question or follow-up.

Critical means something the PR produces is wrong now on a supported reachable path:

1. Wrong output, data loss, a crash, a hang, or a scaling cliff.
2. A wrong or misleading user-facing error.
3. Documentation that instructs a workflow that does not work.
4. False coverage: a new or materially changed test that cannot fail for the claimed regression or
   asserts the wrong behavior.
5. A realistic net-new source-to-sink vulnerability on a default configuration.
6. An unmigrated public API, generator schema, or executor-option break.
7. A claimed fix that still fails its exact accepted input.
8. A missing or malformed load-bearing marker required by committed repository policy.

Important is limited to:

1. `widens`: the PR materially expands the reach of a pre-existing defect without changing the kind
   of harm.
2. A working new user-facing surface with no discoverable documentation.
3. A source comment or public contract statement the diff leaves false.
4. A measured non-cliff performance regression.
5. A concrete new violation of a committed documentation rule that governs the exact surface without
   making the documented workflow fail.
6. A materially better approach when the chosen design adds a concrete large maintenance or regression
   surface and a grounded alternative removes it. A merely different design is not Important.

For performance findings, identify the growth variables, supported workload, and base/HEAD work.
Worsening asymptotic complexity or an unbounded input alone does not establish a Critical scaling
cliff. For a Critical scaling cliff, establish that growth makes the supported operation impractical
or exhausts resources relative to base, through a supported static bound or representative measurement.
State that basis. If the consequence remains uncertain, use a focused deciding check when it can
decide finding retention or tier, or report the unresolved performance question. Do not invent timing
estimates, assume Critical, or downgrade to Important without its required measurement.

A widening that introduces a new kind of harm or exposes a previously unreachable defect is Critical.
Population size never changes the technical tier. State prevalence only with evidence. When an
unknown adoption, recovery, or risk-tolerance fact could change merge disposition, put it in
`MAINTAINER-CONSIDERATION`; do not weaken the finding or tier.

Use a Suggestion only when current behavior is correct, the improvement links to an exact changed
line, and the action and benefit are concrete. A coverage suggestion needs a stable assertion that
would fail for the relevant regression and pass for the intended result. Trace it through the changed
code's responsibility, including its public integration behavior, rather than dependency internals
outside that responsibility. Check relevant existing tests: omit an equivalent assertion unless it
adds a distinct signal. Equivalence means detecting the same regression at the same or a later
user-visible endpoint. Keep at most five.

## Tests

Missing coverage is a Suggestion at most. False coverage is Critical.

For every new or materially changed test, identify the deciding assertion and answer:

> What plausible regression in the claimed behavior would make this assertion fail?

The test is tautological and must be removed or replaced when expected and actual values come from the
same production logic, a mock only returns its configured value, the assertion observes an internal
call instead of the claimed result, a snapshot has no independent contract, or the intended bug can
be restored without failing the assertion. Tautological tests add execution and maintenance cost while
providing no behavioral signal.

For a specific mutation, trace the whole test, including all assertions and asynchronous completion.
Distinguish an executed result from a source-derived counterexample. If the trace cannot establish
that the mutation passes, run a focused check or describe only the independently supported oracle
gap; do not publish the uncertain mutation as proof.

## Comments and documentation

Default to no comment. Keep one only for a non-obvious constraint, invariant, ordering requirement,
deliberate deviation, upstream workaround, dense syntax, or public contract that clearer code cannot
express. Apply the mis-edit test: name the concrete future mistake the comment prevents. Remove dead
prose, including code narration, identifier paraphrases, duplicated facts, investigation or review
history, one-time rationale, merge-bound wording, completed work, stale links, section banners,
hedging, and agent fingerprints. Never request more comments as a finding.

When documentation changes:

- read `astro-docs/README.md`, `astro-docs/STYLE_GUIDE.md`, root `AGENTS.md`, and root `CLAUDE.md`
  completely from the HEAD snapshot;
- read every changed page completely, deleted pages from base, and both sides of renames;
- check links, anchors, redirects, sidebar reachability, Markdoc, terminology, examples, reader flow,
  and actual product behavior;
- run Vale inside the parent-owned sandbox on changed documentation covered by the repository's Vale
  configuration; start the sandbox if needed. Assess diagnostics against the changed content and
  severity bars, and record unavailable execution as a limitation, not a PR defect. Vale never
  substitutes for the page pass;
- edit or assess the committed source of truth, never generated output.

For code changes to public APIs, flags, configuration, environment variables, defaults, deprecations,
errors, or workflows, identify any named hand-written documentation made stale.

## Nx calibration

- Migration silence, retained dependencies, release temporary directories, and migration temporary
  directories are intentional unless a supported input demonstrably fails.
- `migrations.json` is already inside the migration trust boundary. Require a new external boundary
  before reporting a security defect.
- Fix an invariant at its source instead of demanding scattered defensive guards.
- Executor and generator changes must be traced through registration and option normalization.
- Plugin inference and project-graph changes must be assessed at monorepo scale, including traversal,
  hashing, invalidation, and daemon reuse.
- Package-manager behavior must be checked at the final spawned process and nested-workspace boundary.
- Public exports, schemas, migrations, generated references, and prose documentation may be coupled.
- Before reporting compatibility, locate the consumer's actual support contract. A transitive peer
  range proves installability, not support. First-party `@nx/*` packages are released in lockstep,
  and `@nx/devkit/internal` is not cross-version tolerant without a stronger contract.
- For interpolated source, configuration, templates, or commands, classify every inserted value as
  grammar syntax, identifier, or data. Public data must use the target grammar's serializer or an
  escape proven over the full supported input domain.

## Maintainer and author context

An author response or maintainer comment is a claim, not proof of current code. Do not dismiss an
explicit same-scope maintainer call unless new public evidence refutes its stated basis. When a valid
finding survives contract reconciliation and conflicts with a maintainer call, ask the user before
finalizing if the finding's disposition remains unresolved. The outcome is either accepted risk or
retained finding; do not disguise it as a severity change.

Questions must account for the PR description, all acquired relevant task responses, source comments,
and current public evidence. Do not ask something already answered for the same scope.

## Parent adjudication

The parent owns the final finding set. It must independently verify each retained candidate's trigger,
base endpoint, HEAD endpoint, changed cause, attribution, consequence, tier, repair outcome, and any
maintainer consideration. Re-run the selected admission test rather than accepting the lane's label:
`base` requires materially better behavior for the same supported trigger; `no-base-surface` requires
independent authority for the new endpoint; `widens` requires proven additional reach; and
`claimed-fix` requires an accepted source whose own words name the exact input and endpoint. Reject the
complete claim when a material premise is unsupported; do not trim it into a different finding.
Rejecting an admission does not discharge the Pre-existing rule. If the rejection rests on the same
defect and trigger existing unchanged at base, preserve that exact item in the separate Pre-existing
slot without the unsupported changed cause or tier. Return a narrower valid hypothesis to its owning
lane if needed.

Deduplicate only when one retained item preserves every distinct trigger, consequence, and requested
outcome. Keep each consequence tied to its supported trigger; do not assign the worst outcome to
every variant. One root cause is one finding. Never retain a partial lane report as a clean review.
