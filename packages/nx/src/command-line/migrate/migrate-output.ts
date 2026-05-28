import * as pc from 'picocolors';
import { logger } from '../../utils/logger';
import { isHybridMigration } from './migration-shape';

/**
 * Presentation layer for `nx migrate --run-migrations`. Pure helpers — every
 * function maps (state) → (terminal output or string lines). Shared visual
 * vocabulary across the migrate run:
 *   `→` start  ·  `✓` success  ·  `✗` failure  ·  `↷` skipped  ·  `ℹ` info  ·  `─` boundary
 *
 * Inputs are typed structurally (e.g. `{ name: string }[]`) so this module
 * stays decoupled from `ExecutableMigration` and the executor in migrate.ts.
 */

/**
 * Some agent TUIs (codex, opencode) don't fully reset their cursor / SGR state
 * when they exit, which corrupts subsequent orchestrator output. Emit an SGR
 * reset + newline so our log lines land on a clean row instead of being
 * overlaid by leftover status bars.
 */
export function resetSgrAfterAgent(): void {
  process.stdout.write('\x1b[0m\n');
}

/**
 * Per-migration boundary header. Anchors the orchestrator log at the start of
 * each migration with the migration index and identity.
 */
export function logMigrationBoundary(
  index: number,
  total: number,
  pkg: string,
  name: string
): void {
  const label = `── Migration ${index} of ${total} · ${pkg}:${name} `;
  const targetWidth = 73;
  const dashes = Math.max(3, targetWidth - label.length);
  logger.info(`${label}${'─'.repeat(dashes)}`);
}

/**
 * Logs the outcome line that closes an agentic phase. Vocabulary:
 *   ✓ <label>[ (<sha>)]: <summary>
 */
export function logAgenticSuccessOutcome(
  label: string,
  sha: string | null,
  summary: string
): void {
  const shaPart = sha ? ` (${sha})` : '';
  logger.info(`${pc.green('✓')} ${label}${shaPart}: ${summary}`);
}

/**
 * Per-migration outcome record consumed by the failure recap. One entry is
 * appended per iteration that returned without throwing; the failing migration
 * has no record.
 *
 * - `applied`: ran fully to completion, including any agentic step.
 * - `no-changes`: generator ran but produced no diff (counts as applied work).
 * - `deferred`: prompt half was not applied (agent disabled or inside-agent
 *   mode hands it off). For hybrid migrations the deterministic half still ran.
 *
 * `committedAsPartOf` is set when this migration's own commit attempt failed
 * but its diff was later absorbed into a successor migration's commit (which
 * stages the working tree's accumulated state via `git add -A`). The recap
 * uses this to anchor "last applied" honestly when the last-named commit
 * landed multiple migrations' contributions.
 */
export type MigrationOutcomeKind = 'applied' | 'no-changes' | 'deferred';
export interface MigrationOutcome {
  migration: { package: string; name: string };
  outcome: MigrationOutcomeKind;
  // Sha of this migration's own commit. `null` covers three states:
  //   - `commitFailed: true`     → commit attempted, errored; diff
  //                                 retained in the working tree until
  //                                 absorbed (or surfaced at end of run).
  //   - `committedAsPartOf` set  → own commit errored, but a later
  //                                 migration's commit absorbed the diff
  //                                 (own sha lost, the diff DID clear).
  //   - neither flag set         → no commit attempted (`--no-create-commits`
  //                                 or no-op step), OR own commit landed
  //                                 but `git rev-parse HEAD` raced — the
  //                                 recap disambiguates by checking
  //                                 `committedAsPartOf` first.
  committedSha: string | null;
  // Set when a commit was attempted and errored (signing, hook rejection,
  // lock, etc.). Distinct from a plain `committedSha: null`, which also
  // covers `--no-create-commits` and no-op steps. Stays `true` after
  // `committedAsPartOf` is set so the audit view "own commit failed" stays
  // queryable; retained-WT filtering must combine `commitFailed === true`
  // with `!committedAsPartOf`.
  commitFailed?: boolean;
  // Set when this migration's diff was absorbed into a later migration's
  // commit via `git add -A`. `sha: null` means that absorbing commit itself
  // hit a HEAD-resolve race; the recap renders an anchor without a sha.
  committedAsPartOf?: { name: string; sha: string | null };
}

/**
 * Logs a structured recap when a migration throws mid-loop. Inserted between
 * the "Failed to run X" error block and the re-throw so the user (or AI agent
 * driving the run) can see what completed before the failure without scrolling
 * back through the per-migration log to count shas.
 *
 * Counts-based rather than full migration lists so a 24-migration run that
 * fails at #12 doesn't dump 24 names into the recap — readers scroll up to
 * see specifics in the per-migration log. The "last applied" anchor pairs the
 * most recent fully-applied migration with the sha its commit actually
 * produced, so a skipped/deferred step trailing an applied one can't borrow
 * the earlier sha.
 */
export function logFailureRecap(opts: {
  migrationIndex: number;
  totalMigrations: number;
  outcomes: ReadonlyArray<MigrationOutcome>;
  // Migrations whose commits failed and whose diffs are still in the
  // working tree. Includes the in-flight migration if its install threw
  // before an outcome record could be pushed. Listed in the retained
  // section alongside outcome-derived entries; deduped by `package:name`.
  pendingMigrations?: ReadonlyArray<{ package: string; name: string }>;
  migrationEmittedNextSteps: string[];
  insideAgent: boolean;
}): void {
  const {
    migrationIndex,
    totalMigrations,
    outcomes,
    pendingMigrations = [],
    migrationEmittedNextSteps,
    insideAgent,
  } = opts;
  const appliedCount = outcomes.filter(
    (o) => o.outcome === 'applied' || o.outcome === 'no-changes'
  ).length;
  const deferredCount = outcomes.filter((o) => o.outcome === 'deferred').length;
  const notAttempted = totalMigrations - migrationIndex;
  // Walk back to the most recent record whose work is anchored to a sha —
  // either its own commit, or a later commit that absorbed it. Both
  // `applied` AND `deferred` outcomes can carry a successful commit
  // (hybrid-without-agentic produces `deferred` with a sha from its
  // deterministic half). Skipped and uncommitted records don't anchor.
  let lastApplied: MigrationOutcome | undefined;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const o = outcomes[i];
    if (
      (o.outcome === 'applied' || o.outcome === 'deferred') &&
      (o.committedSha || o.committedAsPartOf)
    ) {
      lastApplied = o;
      break;
    }
  }
  // Migrations whose own commit attempt errored AND whose diff was never
  // absorbed by a later commit. Surfaces what the user has to inspect or
  // clean up in the working tree.
  //
  // Two sources, merged and deduped:
  //   - Outcomes with `commitFailed: true && !committedAsPartOf`.
  //   - `pendingMigrations` entries — covers the in-flight migration whose
  //     install threw before its outcome could be pushed, AND any prior
  //     failed-commit migration that's still pending at recap time.
  //
  // Filtering on `commitFailed` (rather than on missing sha) avoids
  // mislabeling intentional-no-commit cases: `--no-create-commits` runs
  // and no-op steps both yield `committedSha: null` without a failure.
  const seenKeys = new Set<string>();
  const uncommittedAtFailure: Array<{
    migration: { package: string; name: string };
  }> = [];
  for (const o of outcomes) {
    if (o.commitFailed !== true || o.committedAsPartOf) continue;
    const key = `${o.migration.package}:${o.migration.name}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uncommittedAtFailure.push({ migration: o.migration });
  }
  for (const p of pendingMigrations) {
    const key = `${p.package}:${p.name}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uncommittedAtFailure.push({ migration: p });
  }

  logger.info('');
  logger.info(
    `Run halted at migration ${migrationIndex} of ${totalMigrations}.`
  );
  if (appliedCount === 0 && deferredCount === 0) {
    logger.info(`0 migrations completed. ${notAttempted} not attempted.`);
  } else {
    const anchorSha =
      lastApplied?.committedSha ?? lastApplied?.committedAsPartOf?.sha;
    // When the anchoring commit hit a HEAD-resolve race, the sha is null;
    // render the migration name alone (without "→ null") so the recap
    // never displays the literal word "null" to the user.
    const anchor = lastApplied
      ? anchorSha
        ? ` (last: ${lastApplied.migration.name} → ${anchorSha})`
        : ` (last: ${lastApplied.migration.name})`
      : '';
    const parts: string[] = [`${appliedCount} applied${anchor}`];
    if (deferredCount > 0) {
      parts.push(`${deferredCount} deferred`);
    }
    logger.info(`${parts.join(', ')}. ${notAttempted} not attempted.`);
    logger.info(`See the per-migration log above for full details.`);
  }
  if (uncommittedAtFailure.length > 0) {
    logger.info('');
    logger.info(
      `Working-tree state retained from ${uncommittedAtFailure.length} migration${
        uncommittedAtFailure.length === 1 ? '' : 's'
      } whose commits could not be created:`
    );
    for (const o of uncommittedAtFailure) {
      logger.info(`  - ${o.migration.package}: ${o.migration.name}`);
    }
    logger.info('');
    logger.info(
      'Inspect with `git status` / `git diff` and either commit them manually or revert before re-running.'
    );
  }
  if (migrationEmittedNextSteps.length > 0) {
    logger.info('');
    logger.info(`Notes from migrations that completed before the failure:`);
    for (const step of migrationEmittedNextSteps) {
      logger.info(`  - ${step}`);
    }
  }
  logger.info('');
  if (insideAgent) {
    logger.info(
      `Report the failure and the recap above to the user. They'll need to fix the failing migration and re-run \`nx migrate --run-migrations\` themselves.`
    );
  } else {
    logger.info(
      `Fix the failing migration and re-run \`nx migrate --run-migrations\` to resume.`
    );
  }
  logger.info('');
}

/**
 * Builds the tally body line shown under the top end-of-run NX block. Returns
 * `null` when there is nothing meaningful to tally (e.g. an empty
 * migrations.json), so the caller can omit the body entirely instead of
 * emitting a misleading `0 prompt migrations skipped.` line.
 *
 * Rule (kept coherent across every scenario):
 * - When at least one migration was applied: `<N> migrations applied, <K> commits created[, <D> prompt migrations <skipped|deferred>]`.
 *   The `<K> commits created` part stays even at 0 — it tells the reader work
 *   was applied but not committed (the J4/J8 information made explicit).
 * - When zero migrations were applied but some prompt halves were
 *   skipped/deferred: `<D> prompt migrations <skipped|deferred>` only.
 * - When zero of either: no body line.
 */
export function buildTallyBodyLine(opts: {
  appliedCount: number;
  committedShasCount: number;
  skippedPromptsCount: number;
  insideAgent: boolean;
}): string | null {
  const { appliedCount, committedShasCount, skippedPromptsCount, insideAgent } =
    opts;
  const skipVerb = insideAgent ? 'deferred' : 'skipped';
  if (appliedCount === 0) {
    if (skippedPromptsCount === 0) return null;
    return `${skippedPromptsCount} prompt migration${
      skippedPromptsCount === 1 ? '' : 's'
    } ${skipVerb}.`;
  }
  const parts = [
    `${appliedCount} migration${appliedCount === 1 ? '' : 's'} applied`,
    `${committedShasCount} commit${committedShasCount === 1 ? '' : 's'} created`,
  ];
  if (skippedPromptsCount > 0) {
    parts.push(
      `${skippedPromptsCount} prompt migration${
        skippedPromptsCount === 1 ? '' : 's'
      } ${skipVerb}`
    );
  }
  return `${parts.join(', ')}.`;
}

/**
 * Body lines for the end-of-run retained-state warning. Fires on the success
 * path — the run completed but one or more migrations' own commits failed
 * and were never absorbed.
 */
export function buildRetainedAtSuccessBody(
  retainedNames: ReadonlyArray<string>
): string[] {
  return [
    ...retainedNames.map((name) => `  - ${name}`),
    '',
    'Their changes are in the working tree. Inspect with `git status` / `git diff` and either commit them manually or revert.',
  ];
}

/**
 * Builds the body lines for the inside-agent directive block. Sub-sections
 * drop independently when empty. Returns an empty array when the block has
 * nothing actionable (no deferred prompts AND no migration-emitted notes) —
 * the caller skips emitting the block entirely in that case.
 */
export function buildDirectiveBlockBodyLines(opts: {
  skippedPrompts: ReadonlyArray<{
    prompt?: string;
    name: string;
    implementation?: string;
    factory?: string;
  }>;
  migrationEmittedNextSteps: string[];
}): string[] {
  const { skippedPrompts, migrationEmittedNextSteps } = opts;
  const hasDeferred = skippedPrompts.length > 0;
  const hasNotes = migrationEmittedNextSteps.length > 0;
  if (!hasDeferred && !hasNotes) return [];

  const lines: string[] = [];
  if (hasDeferred) {
    lines.push('Apply the deferred prompts below, in order:');
    skippedPrompts.forEach((m, i) => {
      const kindHint = isHybridMigration(m)
        ? ' — hybrid prompt phase'
        : ' — prompt-only migration';
      lines.push(`  ${i + 1}. ${m.prompt}`);
      lines.push(`       (${m.name}${kindHint})`);
    });
  }
  if (hasNotes) {
    if (hasDeferred) lines.push('');
    lines.push(
      hasDeferred
        ? 'Then relay these migration-emitted notes to the user:'
        : 'Relay these migration-emitted notes to the user:'
    );
    for (const step of migrationEmittedNextSteps) {
      lines.push(`  - ${step}`);
    }
  }
  lines.push('');
  lines.push(
    hasDeferred && hasNotes
      ? 'Finally, summarize what was done across the run and commit the changes per workspace conventions.'
      : 'Then summarize what was done across the run and commit the changes per workspace conventions.'
  );
  return lines;
}
