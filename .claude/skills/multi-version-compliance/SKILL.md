---
name: multi-version-compliance
description: >
  Apply or review multi-version support compliance for first-party Nx
  plugins. Primary entry point: a Linear task ID (NXC-XXXX) from the
  "Multi-version supported across plugins" milestone — the task carries the
  resolved support window, findings, and "Needs human decision" items. Falls
  back to self-discovery when no task exists. Use when asked to "fix
  multi-version compliance for @nx/X", "do NXC-XXXX", "review this
  compliance PR", or when working on a branch / PR titled "multi-version
  support compliance for @nx/X". Covers the canonical shape
  (assertSupportedPackageVersion, all-generators-enforce-floor.spec.ts,
  peer dep alignment, requires-gate auditing, user-pin preservation,
  executor / inferred-plugin feature gating).
argument-hint: '[<NXC-XXXX> | @nx/<plugin> | review #<PR>]'
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent, mcp__linear-server__get_issue, mcp__linear-server__list_comments, mcp__linear-server__get_milestone, mcp__linear-server__list_issues
---

# Multi-version compliance for Nx plugins

## What this is

The `nx migrate --first-party-only` flag lets users upgrade Nx without
dragging the managed third-party ecosystems (Angular, Cypress, Playwright,
Jest, Vitest, ESLint, etc.) along. For that to be safe, every first-party
plugin must keep working across its declared support window — not silently
fall through to the latest install constants on older workspaces, not
silently break on newer ones.

**Source-of-truth split:**

| Source                                                                       | Owns                                                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Linear milestone "Multi-version supported across plugins" (project NXC-4072) | What's wrong per plugin, the resolved support window, open human decisions. Per-plugin tasks NXC-4381..NXC-4410 (P1–P29). |
| This skill                                                                   | How to implement the canonical shape, code-level anti-patterns, gotchas, findings doc shape (no-task case).               |

The skill is the gap-closer: it accepts a Linear task, parses it, drives
the fix. When no task exists for the plugin, fix mode runs discovery in
Phase 1–2 and produces a findings doc that mirrors a Linear task body —
so the user can file it as a new task before proceeding.

**Reference PRs (the canonical shape):**

- `#35587` — `@nx/angular` — merged. Set the precedent. Introduced
  `throwForUnsupportedVersion`.
- `#35642` — `@nx/playwright` — merged. Generalized the shared helpers
  into `@nx/devkit/internal`. Established executor / runtime feature-
  gating.
- `#35670` — `@nx/cypress` — merged. Added `excludeGenerators` to the
  parameterized test helper.
- `#35671` — `@nx/vitest` — open at time of writing. Demonstrates
  "drop phantom peer-range claim" and "declared floor < effective floor"
  patterns.

Before citing any PR by number, verify state — these go stale:
`gh pr view <N> --repo nrwl/nx --json state`. Verify any unmerged PR's
contents via `gh pr diff <N> --repo nrwl/nx`.

## Entry points

| Invocation                                            | Mode              | Behavior                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `multi-version-compliance <NXC-XXXX>`                 | Fix (primary)     | Fetch task, surface findings + decisions in Phase 2, wait for user OK before Phase 3 edits.                                                                                                                                         |
| `multi-version-compliance` (no arg)                   | Ask for task ID   | Prompt for NXC-XXXX.                                                                                                                                                                                                                |
| `multi-version-compliance @nx/<plugin>` (bare plugin) | Fix (task lookup) | Look up the per-plugin task in milestone NXC-4072. If found, confirm with user and enter fix mode. If not found, run discovery in Phase 1–2 (rubric against code), present findings, suggest filing as a new task before any edits. |
| `multi-version-compliance review #<N>`                | Review            | Fetch PR, derive Linear task from branch name if possible, compare diff vs. task findings (or run pure code-level review if no task).                                                                                               |

**Stop-after-Phase-2 (audit-equivalent):** if you want findings without
edits, decline to approve at the end of Phase 2. The skill stops, no
branch, no commits.

**On a branch matching `nxc-NNNN` with no explicit arg:** before
asking the user, suggest "Use NXC-NNNN?" inferred from the branch name.

## Linear-fetching protocol

Before any code-level work in Linear-driven mode, the skill MUST:

1. **Check Linear MCP availability.** If `mcp__linear-server__get_issue`
   isn't available (MCP server not installed / not connected), tell the
   user and fall through to the no-task discovery path (fix mode Phase 1
   step 2). Don't pretend to fetch.
2. **Fetch the task.** `mcp__linear-server__get_issue id="NXC-XXXX"`.
   If the call errors (invalid ID, network), halt and ask the user to
   verify the ID.
3. **Verify shape.** Confirm:
   - Title matches `[multi-version][P##] \`@nx/<plugin>\` — multi-version support compliance`(per-plugin) or`[multi-version][W#] ...` (cross-cutting). If the pattern doesn't match, halt and ask the user to confirm this is the right task.
   - Status. `Done` → ask whether re-audit or follow-up. `Canceled` → halt and ask.
4. **Read description sections.** Every per-plugin task has:
   - **Plugin:** — path, upstream support, peerDep declarations, per-major install map, paired secondaries.
   - **Needs human decision** — open items blocking implementation.
   - **Findings** — `(high|medium|low)` items with `[file:line]` and a suggested fix per item.
   - **Verification checklist** — Sections A (Support window declarations) / B (Generator inputs) / C (Generator outputs) / D (Migrations) / E (Runtime) / F (Out-of-window UX).
5. **Fetch comments.** `mcp__linear-server__list_comments issueId="..."`.
   Audits attached as files / linked uploads may carry additional
   context.
6. **Surface "Needs human decision" as a batch.** Restate every decision
   item in chat. The user can resolve all, defer some, or override.
   Block until the user has acknowledged the set — don't proceed silently.
7. **Translate findings → code changes.** Map each finding to a canonical
   pattern in `references/canonical-shape.md`. The Linear task's
   suggested fix is the authoritative scope; the skill verifies it
   conforms to the canonical shape and flags any deviation.
8. **Run the A–F checklist** against the final code state. The task's
   checklist is the agreed scope. The skill verifies code-level
   conformance.

**Default to the task's resolved support window.** Don't re-derive it
from code unless the user explicitly overrides. If the user overrides:
restate the new window and confirm before applying.

**Don't expand scope beyond the task's Findings without asking.** If you
spot a new issue mid-fix: stop, present it, ask whether to (a) add it to
this PR, (b) defer as a follow-up, or (c) update the Linear task as a
comment.

## Mode workflows

### Fix mode (primary)

**Phase 1 — Read.**

1. If a Linear task ID was provided, fetch it per the Linear-fetching
   protocol. If only a plugin name was provided, look up the per-plugin
   task in milestone NXC-4072.
2. **No task case.** If no task exists for this plugin: run discovery
   instead — apply the policy ladder for the support window
   (Rule 1: upstream LTS for Angular/React/ESLint/Next/Expo; Rule 2:
   N & N-1; widen to existing supported set if larger), inventory the
   plugin's code against the A–F rubric, find the effective floor by
   walking imports, classify all results as new findings. The skill is
   producing audit-quality output for a plugin that wasn't ticketed.
3. If on a branch matching `nxc-NNNN`, read recent commits to understand
   prior scope decisions.
4. Read `references/canonical-shape.md` and `references/anti-patterns.md`.

**Phase 2 — Align.**

5. **(task case)** Surface every "Needs human decision" item from the
   task as a batch. Wait for resolutions.
6. **(task case)** Restate the Findings list with severity tags. Confirm
   scope.
7. **(no-task case)** Surface findings discovered from the rubric
   inventory + decisions the rubric surfaces (floor raise/drop, peer
   declarations, optional-vs-required peer, one-sided gates, etc.).
   Suggest filing them as a new Linear task in milestone NXC-4072
   before proceeding to Phase 3.
8. **User OK gate.** Wait for explicit "proceed" before Phase 3.
   Declining stops the skill — no branch, no edits. (This is the
   audit-equivalent.)

**Phase 3 — Implement** (per `canonical-shape.md`).

9. Branch from `master` if needed using the repo's `nxc-NNNN` convention.
10. Order: any shared-helper extension lands first; plugin changes land
    after. Commit/PR titling defers to the user's conventions.
11. For each Finding category, apply the canonical pattern:
    - Section A → peer ranges + version map + install constants. Every
      third-party package the plugin **invokes at runtime** (TS import,
      executor spawning the CLI binary, or inferred-plugin emitting a
      target with `command: '<bin>'`) gets a peer entry. Default to
      `optional: true` via `peerDependenciesMeta` for gated surfaces
      (executor opt-in, inferred plugin gated on config file presence).
      Non-optional peers are reserved for packages every workspace using
      the plugin needs.
    - Section B → generator entry asserts, `keepExistingVersions`,
      fresh-install branch.
    - Section C → templates, schema stubs with runtime throws,
      version-map coverage.
    - Section D → `requires` gates per package per AND-semantics; split
      mixed entries; retain intentional pre-floor entries. **Default to
      bilateral bounds** (`>=N <M`) when writing a cross-major gate.
      One-sided gates (`<N` with no lower, `>=N` with no upper) need a
      justified reason (legacy cleanup, undefined source, v0→v1 bridge)
      — record the reason in the findings doc or as a code comment.
    - Section E → executor and inferred-plugin feature gates.
    - Section F → below-floor throw via shared util.
    - **Cross-cutting:** if the fix changes runtime behavior, update any
      in-codebase docs (`astro-docs/`, `docs/`, inline `.md`) that
      describe the changed behavior. Docs that contradict the code are a
      correctness bug, not a PR-body concern.
12. If during implementation you spot something not in the task's
    Findings: stop, surface it, ask whether to (a) add to this PR, (b)
    defer as a follow-up, or (c) update the Linear task as a comment.

**Phase 4 — Tests** (same commit as Phase 3 usually).

13. Add `all-generators-enforce-floor.spec.ts` — parameterized via
    `assertGeneratorsEnforceVersionFloor`. This exercises every
    generator's floor assert and is the high-value spec.
14. Footgun: assert calls must be in place in every generator BEFORE
    running the parameterized spec, or every untouched generator fails
    and you'll restart.
15. Optional: a per-plugin `assert-supported-<pkg>-version.spec.ts`
    with the 5 canonical cases. The shared `assertSupportedPackageVersion`
    already has full coverage in devkit, so this is mostly symmetry
    across the PR series — skip unless the user asks.

**Phase 5 — Verify locally.**

16. `npx nx test <plugin> --testPathPattern="all-generators-enforce-floor"`
    (add `assert-supported-` if you added the optional wrapper spec).
17. `npx nx test <plugin> --testPathPattern="<modified-generator>"` per
    touched generator.
18. `npx nx format`.

**Phase 6 — Hand off.** Code changes complete. The user drives
commit/push/PR per their own conventions (loaded globally from
`~/.claude/memory/workflow/git/`). This skill does not enforce PR title,
body, commit shape, or related-issues format.

### Review mode

1. **Fetch PR.** `gh pr view <N> --repo nrwl/nx` and
   `gh pr diff <N> --repo nrwl/nx`. For a local branch:
   `git diff master...HEAD`.
2. **Derive the Linear task.** Branch name `nxc-NNNN` → `NXC-NNNN`. If
   no match: ask the user.
3. **Fetch the task** (if derivable). Compare diff vs. task Findings:
   every Finding addressed; nothing extra without justification. Flag
   scope drift.
   **If no task and the user has none:** skip task-comparison; run pure
   code-level review against `canonical-shape.md` and `anti-patterns.md`.
4. **Code-level checks.** Run the "Code-level verification (review-mode
   lens)" section of `canonical-shape.md`. Cross-reference
   `anti-patterns.md`. For each finding, anchor at `file:line` and cite
   which reference PR / file demonstrates the correct pattern.
   **Scope:** code, configs, migrations, and in-codebase docs that claim
   runtime behavior. NOT PR title / body / commit shape — those defer to
   the user's PR conventions.
5. **Classify each finding.**
   - **Only two inline categories:** `[blocker]` and `[non-blocker]`. No
     "open question," "ask," or other inline tags. Questions for the
     author surface in the closing "Open questions for author" block,
     drawn from non-blocker findings — list each question once.
   - **Severity is independent of scope-drift.** A finding can be both a
     blocker AND not in the Linear task. Flag it as a blocker in the
     code-level section AND list it under "in PR but not in Linear task"
     in scope drift. Don't hedge with "in this PR or follow-up?" — if
     it's a blocker, the answer is "this PR."
   - **Group related non-blockers.** When multiple non-blockers describe
     symptoms of one blocker (e.g., five symptoms of a single
     `version-utils.ts` duplication), list them as sub-bullets under
     the blocker with "(resolved when §X is fixed)" rather than as N
     separate top-level non-blockers.
   - **Be terse on passes.** A section with no findings gets a single
     summary line ("Pass — all 7 generator entries assert at first
     statement"), not a per-file enumeration. Detail is reserved for
     blockers and non-blockers. The reviewer's audience skims for
     actionable items; passing checks should not eat reading budget.
6. **Output.** Markdown checklist of blockers / non-blockers anchored at
   `file:line`, followed by the structured verdict block from
   `canonical-shape.md` §"Verdict template". The verdict block is the
   skimmable index — produce it, don't substitute a free-form prose
   summary. Do not post via `gh pr review` unless the user explicitly
   asks.

## Which references to load (context hygiene)

| Mode                         | Required                                                                                    | Optional                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Fix                          | `canonical-shape.md`, `anti-patterns.md`                                                    | `gotchas.md` (effective floor, ecosystem lockstep, cypress inline tree), `examples.md` (when copying a pattern) |
| Review                       | `anti-patterns.md`, `canonical-shape.md` (especially the "Code-level verification" section) | `gotchas.md` (cross-plugin coordination, lockstep), `examples.md` (when citing)                                 |
| "What is compliance?" answer | none                                                                                        | answer from SKILL.md alone                                                                                      |

References are ~100–500 lines each. Don't pull all of them just because
you're invoked. Match the load to the mode.

## Critical rules (apply in every mode)

1. **Linear task is the source of truth for scope** (ratified decisions
   and Findings).
   - (a) Don't produce a parallel scope document. The task IS the scope.
     Fix mode runs against the task as input — drift checks, new
     findings, and decisions feed back to the task (via comments or as
     deferred items), not into a competing source of truth.
   - (b) Don't expand a fix beyond the task's Findings without
     surfacing the new issue.
   - (c) Don't second-guess the task's resolved support window without
     an explicit user override.
2. **Do not create or duplicate shared helpers.** They live in
   `@nx/devkit/internal` (`assertSupportedPackageVersion`,
   `getInstalledPackageVersion`, `getDeclaredPackageVersion`,
   `throwForUnsupportedVersion`, `normalizeSemver`, `isNonSemverDistTag`)
   and `@nx/devkit/internal-testing-utils`
   (`assertGeneratorsEnforceVersionFloor`). Reject any local
   re-implementation (`cleanVersion`, `getInstalled<Pkg>VersionRuntime`,
   private `throwBelowFloor`, etc.). See `canonical-shape.md`.
3. **Above-ceiling is silent fallthrough.** Do not warn, do not throw,
   do not branch. Reject `throwAboveWindow`, `warnAboveCeiling`,
   `versions()` with `switch + throw default:`. The only throw is below
   the declared floor.
4. **`keepExistingVersions: true` is for generators only.** Migration
   generators (`src/migrations/`) are exempt — their job is to bump.
   Do not flag missing flags in migration code.
5. **Floor assert is the first statement in the function doing the
   actual work.** Wrapper/internal split (cypress, playwright): in
   `*Internal`. Single-function generators (angular): in the function
   itself. Not conditional, not inside an install branch, not after a
   tree read.
6. **Phase 1–2 never writes, never branches.** Discovery, finding
   classification, and decision-surfacing happen on the current branch
   with no edits. Any working artifact (e.g., a findings doc for a
   no-task case, multi-plugin scratch notes) goes in `tmp/` (gitignored)
   and stays uncommitted. No `TRIAGE-REPORT.md` / `AUDIT.md` at repo
   root. Branch creation and edits start at Phase 3, after the user OK.
7. **PR / commit conventions are out of scope.** Title format, body shape,
   commit-message structure, related-issues handling, push flags, etc.
   are governed by the user's global memory (`pr-creation-shorthand.md`,
   `push-conventions.md`, `explain-before-committing.md`,
   `chore-not-fix-non-prod.md`). Don't enforce or flag these from this
   skill — defer to whatever the user's conventions resolve to at PR time.

## Findings doc template (Phase 2 output, used when no Linear task exists)

When fix mode hits the no-task case (Phase 1 step 2), produce
`tmp/<plugin>-findings.md` shaped to mirror a Linear task body so the
user can file it as a new task in milestone NXC-4072 before proceeding
to Phase 3.

For plugins managing multiple primary packages, repeat the install-map
/ decisions / findings bullets per primary.

```md
# @nx/<plugin> — multi-version support compliance findings

> No Linear task in milestone NXC-4072. This doc is filing-ready —
> create the task with this body before proceeding to fix.

## Plugin

- Path: packages/<plugin>
- Upstream support: <official policy if any, else "no formal LTS">
- peerDep declarations: <list>
- Per-major install (`<file>` branches on installed `<package>` major):
  - v<N-1>: <constants>
  - v<N>: <constants> (default)
- Paired secondaries: <list of ecosystem-locked siblings>

## Needs human decision

1. <decision 1 — e.g., raise floor to vN.0.0 vs keep current>
2. <decision 2 — e.g., drop ^1.0.0 from peer (no v1 install lane)>

## Findings

- **(high) <one-line summary>** [file:line]
  _Suggested fix_: <one-line>
- **(medium) ...**
- **(low) ...**

## Verification checklist (A–F)

### A. Support window declarations

- [ ] peerDep ranges match the support window
- [ ] Version map / runtime branching covers every supported major
- [ ] Every third-party package the plugin **invokes at runtime** has a peerDep entry. "Invokes" = TS import/`require` OR executor spawns its CLI binary OR inferred plugin emits a target whose `command` invokes its CLI (look for `externalDependencies: ['<pkg>']` in emitted target inputs). Packages the generator installs for the user to consume independently (ESLint plugins loaded by the user's eslintrc, `@types/*`) don't need peer-declaration.
- [ ] Peers needed only when a user opts into a specific surface (executor opt-in, inferred plugin gated on config file presence, opt-in preset) are declared **optional** via `peerDependenciesMeta: { "<pkg>": { "optional": true } }`. Required-non-optional peers are reserved for packages every workspace using the plugin needs.

### B. Generator inputs

- [ ] Generators don't overwrite installed third-party versions
  - [ ] `addDependenciesToPackageJson` passes `keepExistingVersions=true` or branches on detected version
- [ ] Fresh-install path installs the latest supported version

### C. Generator outputs

- [ ] Templates compile and run on every supported version
- [ ] Generated `project.json` target shape valid on every major
- [ ] Default option values valid on every major
- [ ] Version map covers every managed third-party dep — no gaps
- [ ] Schema accepts union of options; runtime throws when inapplicable

### D. Migrations (migrations.json + packageJsonUpdates)

- [ ] Cross-major `packageJsonUpdates` declare `requires` per bumped package
- [ ] `requires` ranges are bilateral (`>=N <M`) by default. One-sided ranges (`<N` with no lower, `>=N` with no upper) are intentional (legacy cleanup, undefined source major, v0→v1 bridge) — flagged in "Needs human decision" or noted in the Findings.
- [ ] Every migration declares `requires` against the touched package
- [ ] Nx-only migrations have no third-party `requires`
- [ ] No silent gap in `packageJsonUpdates` across the support window

### E. Runtime

- [ ] Executors branch on installed version where behavior diverges
- [ ] Inferred plugin (createNodes/V2) parses configs across every major

### F. Out-of-window UX

- [ ] Below-floor: throws via shared util naming package + installed + floor; no silent fall-through

## Out-of-scope (deferred follow-ups)

- <e.g., consolidate ... across plugins — separate PR>
```

## References

See "Which references to load" near the top. Don't pull all of them.
