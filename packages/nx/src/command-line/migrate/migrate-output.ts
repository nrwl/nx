import * as pc from 'picocolors';
import { logger } from '../../utils/logger';
import { isHybridMigration } from './migration-shape';

/**
 * Pure presentation helpers for the migrate run phase (`--run-migrations` and
 * the single-migration worker). Shared glyph vocabulary:
 *   `→` start, `✓` success, `✗` failure, `↷` skipped, `ℹ` info, `─` boundary
 *
 * Inputs are typed structurally (e.g. `{ name: string }[]`) so this module
 * stays decoupled from the migration executor in migrate.ts.
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
 * Callers must already know an agentic step was owed; this only picks which one
 * the waiver dropped. The dropped-`agentContext` note is aimed at the migration
 * author, hence `--verbose`.
 */
export function logWaivedAgenticStep(
  migration: {
    package: string;
    name: string;
    prompt?: string;
    implementation?: string;
    factory?: string;
  },
  agentContext: string[]
): void {
  logger.info(
    pc.dim(
      isHybridMigration(migration)
        ? '↷ Prompt phase skipped. The migration reported nothing left for the AI step to do.'
        : '↷ Validation skipped. The migration reported its changes need no AI review.'
    )
  );
  if (agentContext.length === 0) return;
  logger.verbose(
    `${migration.package}: ${migration.name} returned skipAgentic: true alongside agentContext, which was dropped. agentContext exists to feed the AI step this migration waived.`
  );
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

/**
 * The state of a migration's commit attempt. Tagged union so consumers don't
 * have to re-derive legal combinations from nullable fields.
 *
 * - `none`     — no commit was attempted (`--no-create-commits` or no diff to
 *                commit).
 * - `landed`   — a commit was actually created. `sha: null` only when
 *                `git rev-parse HEAD` failed transiently right after the
 *                commit landed; by contract the diff did clear.
 * - `failed`   — commit was attempted and errored (signing, hook rejection,
 *                lock, install error mid-attempt, etc.). The diff stays in
 *                the working tree until a later migration's commit absorbs
 *                it (then transitions to `absorbed`) or until the run ends
 *                (then surfaces as retained state).
 * - `absorbed` — own commit failed but a later migration's commit absorbed
 *                this diff via `git add -A`. `into.sha: null` means that
 *                absorbing commit itself hit a HEAD-resolve race; the recap
 *                renders an anchor without a sha.
 */
export type CommitState =
  | { kind: 'none' }
  | { kind: 'landed'; sha: string | null }
  | { kind: 'failed' }
  | { kind: 'absorbed'; into: { name: string; sha: string | null } };

/**
 * Per-migration record produced by the executor loop. `status: 'completed'`
 * carries the kind (applied / no-changes / deferred); `status: 'aborted'`
 * means the migration threw before completing — the executor's catch block
 * records it so the recap can list it under retained-state alongside any
 * other migrations whose commits never landed.
 *
 * `waivedAgenticStep` is set when the migration returned `skipAgentic: true`
 * and something was actually waived: a hybrid's prompt, which is owed in every
 * agentic mode, or a generator-only migration's validation step, only when it
 * would have run. Recorded here rather than counted in the executor so the
 * success tally and the failure recap derive the same number from the same
 * records instead of threading a counter through both.
 */
export type MigrationOutcome =
  | {
      migration: { package: string; name: string };
      status: 'completed';
      kind: MigrationOutcomeKind;
      commit: CommitState;
      waivedAgenticStep?: boolean;
    }
  | {
      migration: { package: string; name: string };
      status: 'aborted';
      commit: CommitState;
    };

/**
 * Counts the migrations whose own commit actually landed — including the
 * HEAD-resolve-race case (`commit: { kind: 'landed', sha: null }`). Used by
 * the end-of-run "<K> commits created" tally and by the success-path
 * accounting in `executeMigrations`. Counts landed-commit *records* rather
 * than distinct shas; absorbed predecessors (`kind: 'absorbed'`) are not
 * counted because the absorbing commit's record already contributes one.
 */
export function countLandedCommits(
  outcomes: ReadonlyArray<MigrationOutcome>
): number {
  return outcomes.filter((o) => o.commit.kind === 'landed').length;
}

/**
 * Counts the migrations that waived the AI step they would otherwise have
 * run. Shared by the success tally and the failure recap so the two can't
 * report different numbers.
 */
export function countWaivedAgenticSteps(
  outcomes: ReadonlyArray<MigrationOutcome>
): number {
  return outcomes.filter(
    (o) => o.status === 'completed' && o.waivedAgenticStep === true
  ).length;
}

/**
 * The recap phrase for waived AI steps. "not needed" rather than
 * "skipped"/"deferred", which both recaps reserve for work the user still
 * owes.
 */
export function formatWaivedAgenticSteps(count: number): string {
  return `${count} AI step${count === 1 ? '' : 's'} not needed`;
}

/**
 * Migrations whose own commit attempt failed and whose diff was never
 * absorbed by a later commit. Surfaces what the user has to commit or
 * revert after the run. Filters on `commit.kind === 'failed'` exactly —
 * `'absorbed'` means the diff cleared into a later commit, `'none'` means
 * no commit was attempted (intentional `--no-create-commits` or no-op).
 */
export function retainedMigrations(
  outcomes: ReadonlyArray<MigrationOutcome>
): Array<{ package: string; name: string }> {
  return outcomes
    .filter((o) => o.commit.kind === 'failed')
    .map((o) => ({ package: o.migration.package, name: o.migration.name }));
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
  migrationEmittedNextSteps: string[];
  insideAgent: boolean;
}): void {
  const {
    migrationIndex,
    totalMigrations,
    outcomes,
    migrationEmittedNextSteps,
    insideAgent,
  } = opts;
  const appliedCount = outcomes.filter(
    (o) =>
      o.status === 'completed' &&
      (o.kind === 'applied' || o.kind === 'no-changes')
  ).length;
  const deferredCount = outcomes.filter(
    (o) => o.status === 'completed' && o.kind === 'deferred'
  ).length;
  const waivedAgenticCount = countWaivedAgenticSteps(outcomes);
  const notAttempted = totalMigrations - migrationIndex;
  // Walk back to the most recent completed record whose work is anchored to
  // a sha — either its own commit (`landed`), or a later commit that
  // absorbed it (`absorbed`). Both `applied` AND `deferred` outcomes can
  // carry a successful commit (hybrid-without-agentic produces `deferred`
  // with a sha from its deterministic half). Skipped and uncommitted
  // records don't anchor.
  let lastApplied:
    | Extract<MigrationOutcome, { status: 'completed' }>
    | undefined;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const o = outcomes[i];
    if (o.status !== 'completed') continue;
    if (
      (o.kind === 'applied' || o.kind === 'deferred') &&
      (o.commit.kind === 'landed' || o.commit.kind === 'absorbed')
    ) {
      lastApplied = o;
      break;
    }
  }
  // Migrations whose own commit attempt errored AND whose diff was never
  // absorbed by a later commit. Surfaces what the user has to inspect or
  // clean up in the working tree. Single iteration over `outcomes` —
  // `outcomes` is the sole source of truth (including the in-flight
  // migration recorded by the executor's catch block), so no dedupe is
  // needed. `kind: 'failed'` excludes `kind: 'none'` (intentional no-commit:
  // `--no-create-commits` runs and no-op steps).
  const uncommittedAtFailure: Array<{
    migration: { package: string; name: string };
  }> = [];
  for (const o of outcomes) {
    if (o.commit.kind !== 'failed') continue;
    uncommittedAtFailure.push({ migration: o.migration });
  }

  logger.info('');
  logger.info(
    `Run halted at migration ${migrationIndex} of ${totalMigrations}.`
  );
  if (appliedCount === 0 && deferredCount === 0) {
    logger.info(`0 migrations completed. ${notAttempted} not attempted.`);
  } else {
    const anchorSha =
      lastApplied === undefined
        ? undefined
        : lastApplied.commit.kind === 'landed'
          ? lastApplied.commit.sha
          : lastApplied.commit.kind === 'absorbed'
            ? lastApplied.commit.into.sha
            : undefined;
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
    if (waivedAgenticCount > 0) {
      parts.push(formatWaivedAgenticSteps(waivedAgenticCount));
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
 * - When at least one migration was applied: `<N> migrations applied, <K> commits created[, <D> prompt migrations <skipped|deferred>][, <W> AI steps not needed]`.
 *   The `<K> commits created` part stays even at 0 — it tells the reader work
 *   was applied but not committed (the J4/J8 information made explicit).
 * - When zero migrations were applied but some prompt halves were
 *   skipped/deferred: `<D> prompt migrations <skipped|deferred>` only. Waiving
 *   never adds to `skippedPromptsCount`, so `appliedCount` is non-zero whenever
 *   `waivedAgenticStepsCount` is, and this branch can't be reached with one.
 * - When zero of either: no body line.
 */
export function buildTallyBodyLine(opts: {
  appliedCount: number;
  committedShasCount: number;
  skippedPromptsCount: number;
  waivedAgenticStepsCount: number;
  insideAgent: boolean;
}): string | null {
  const {
    appliedCount,
    committedShasCount,
    skippedPromptsCount,
    waivedAgenticStepsCount,
    insideAgent,
  } = opts;
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
  if (waivedAgenticStepsCount > 0) {
    parts.push(formatWaivedAgenticSteps(waivedAgenticStepsCount));
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
