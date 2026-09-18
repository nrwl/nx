// The facts an init reports when it finds a run already active, so the user
// (or the agent relaying to them) can choose between continuing the run and
// starting fresh. Facts only: nothing here decides, and anything that could
// not be established says so instead of guessing.

import {
  getAncestorStatus,
  getGitCurrentBranch,
  getLatestCommitSha,
  type AncestorStatus,
} from '../../../utils/git-utils';
import { formatAge, hasLineBreak, singleLine } from '../text';
import {
  findActiveRun,
  NewerRunStateFormatError,
  type MigrateCommitKind,
  type MigrateCommitLedgerEntry,
  type MigrateRunPolicy,
  type MigrateRunState,
} from './run-state';
import { unresolvedIssues } from './issues';
import { stepLabel, tallySteps, type StepTally } from './state-machine';
import { isPidAlive, runMigrationsFlag } from './util';

// The stalled count is a subset of `remaining`, called out separately: the
// count alone would read as work that has not been reached yet. Adopted and
// unresolved appear only when present, so the common line stays short.
export function progressLine(tally: StepTally): string {
  return `${tally.applied} applied, ${
    tally.adopted > 0 ? `${tally.adopted} adopted, ` : ''
  }${tally.skipped} skipped, ${
    tally.unresolved.length > 0 ? `${tally.unresolved.length} unresolved, ` : ''
  }${tally.remaining} remaining${
    tally.stalled > 0 ? ` (${tally.stalled} awaiting a decision)` : ''
  }`;
}

export interface ExistingRunFacts {
  runId: string;
  createdAt: string;
  recordedBranch: string | undefined;
  currentBranch: string | null;
  progress: StepTally;
  // Reported problems nobody has fixed yet; a run completing with any of them
  // exits 1, so the count matters to the continue-or-restart decision.
  unresolvedIssues: number;
  // The recorded commit and install policy; a continue runs under it.
  policy: MigrateRunPolicy;
  commits: {
    recorded: number;
    reachable: number;
    unchecked: number;
    // sha null when the newest entry landed without one.
    newest: { sha: string | null; status: AncestorStatus } | null;
  };
  liveWorkers: { pid: number; stepId: string; label: string }[];
  // 'unknown' when a run from a newer nx sits on disk: whether it is active
  // cannot be read here, and a reconcile must not fail over a sibling run.
  otherActiveRuns: string[] | 'unknown';
  // Applied migrations the incoming plan lists again; undefined when the
  // caller has no plan (a reconcile).
  appliedStillPlanned: number | undefined;
  // The run a start-fresh named when it is not the one reported.
  replacedRunId?: string;
}

export function collectExistingRunFacts(
  root: string,
  runId: string,
  state: MigrateRunState,
  plannedMigrationIds?: readonly string[]
): ExistingRunFacts {
  const head = getLatestCommitSha(root);
  // A landed entry may have lost its sha to a transient rev-parse failure;
  // it still counts, as a commit that could not be checked.
  const commits = recordedCommits(state);
  const statuses = commits.map((entry) =>
    entry.sha && head
      ? getAncestorStatus(entry.sha, head, root)
      : ('unknown' as const)
  );
  const newestIndex = commits.length - 1;
  const planned = plannedMigrationIds ? new Set(plannedMigrationIds) : null;
  return {
    runId,
    createdAt: state.createdAt,
    recordedBranch: state.branch,
    currentBranch: getGitCurrentBranch(root),
    progress: tallySteps(state),
    unresolvedIssues: unresolvedIssues(state).length,
    policy: {
      createCommits: state.createCommits,
      skipInstall: state.skipInstall === true,
    },
    commits: {
      recorded: commits.length,
      reachable: statuses.filter((s) => s === 'ancestor').length,
      unchecked: statuses.filter((s) => s === 'unknown').length,
      newest:
        newestIndex >= 0
          ? {
              sha: commits[newestIndex].sha ?? null,
              status: statuses[newestIndex],
            }
          : null,
    },
    // Only a step recorded as running can own a worker; a died or finished
    // step's pid may have been reused by an unrelated process since.
    liveWorkers: state.steps
      .filter((s) => s.status === 'running' && s.pid !== undefined)
      .filter((s) => isPidAlive(s.pid))
      .map((s) => ({ pid: s.pid, stepId: s.id, label: stepLabel(s) })),
    otherActiveRuns: otherActiveRuns(root, runId),
    appliedStillPlanned: planned
      ? state.steps.filter(
          (s) =>
            s.kind === 'migration' &&
            s.status === 'succeeded' &&
            planned.has(s.migrationId)
        ).length
      : undefined,
  };
}

// The commits the run made, in ledger order.
export function recordedCommits(
  state: MigrateRunState
): MigrateCommitLedgerEntry[] {
  return state.commits.filter((entry) => madeCommit(entry.kind));
}

function madeCommit(kind: MigrateCommitKind): boolean {
  switch (kind) {
    case 'checkpoint':
    case 'landed':
      return true;
    case 'failed':
      return false;
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled commit kind '${exhaustive}'.`);
    }
  }
}

function otherActiveRuns(root: string, runId: string): string[] | 'unknown' {
  try {
    return findActiveRun(root).activeRunIds.filter((id) => id !== runId);
  } catch (e) {
    if (e instanceof NewerRunStateFormatError) {
      return 'unknown';
    }
    throw e;
  }
}

export interface ExistingRunCommands {
  continueCommand: string;
  // A path that cannot be rendered as executable text for this shell is named
  // in prose instead of a command (see runMigrationsFlag and displayPath).
  startFresh: { command: string } | { migrationsPath: string };
}

export function renderStartFresh(
  migrationsPath: string | undefined,
  command: (runMigrationsFlag: string) => string
): ExistingRunCommands['startFresh'] {
  if (migrationsPath === undefined) {
    return { command: command('--run-migrations') };
  }
  const flag = runMigrationsFlag(migrationsPath);
  return flag === null ? { migrationsPath } : { command: command(flag) };
}

/**
 * Title plus body lines, in the shape the agent-output writers take. Every
 * body line goes through `singleLine`: branch names and timestamps came from
 * git and disk, and the lines end up on the stdout the agent scans for
 * blocks. The title carries only the run id, which discovery validated.
 */
export function renderExistingRunReport(
  facts: ExistingRunFacts,
  commands?: ExistingRunCommands
): { title: string; bodyLines: string[] } {
  const lines = [
    ...(facts.replacedRunId !== undefined
      ? [
          `Not deleting ${facts.replacedRunId}: the newest active run is ${facts.runId}.`,
        ]
      : []),
    `  run: ${facts.runId}`,
    `  started: ${facts.createdAt} (${formatAge(facts.createdAt)})`,
    `  branch: ${branchLine(facts)}`,
    `  progress: ${progressLine(facts.progress)}`,
    `  policy: per-migration commits ${facts.policy.createCommits ? 'on' : 'off'}, installs ${facts.policy.skipInstall ? 'skipped' : 'on'}`,
    `  commits: ${commitsLine(facts.commits)}`,
    `  worker: ${workersLine(facts.liveWorkers)}`,
  ];
  if (facts.unresolvedIssues > 0) {
    lines.push(`  issues: ${facts.unresolvedIssues} unresolved`);
  }
  if (facts.otherActiveRuns === 'unknown') {
    lines.push(
      `  other active runs on disk: unknown (a run written by a newer nx is on disk)`
    );
  } else if (facts.otherActiveRuns.length > 0) {
    lines.push(
      `  other active runs on disk: ${facts.otherActiveRuns.join(', ')}`
    );
  }
  if (facts.appliedStillPlanned !== undefined) {
    lines.push(
      `  plan overlap: ${facts.appliedStillPlanned} of the applied migrations ${
        facts.appliedStillPlanned === 1 ? 'is' : 'are'
      } still in the plan; a new run applies ${
        facts.appliedStillPlanned === 1 ? 'it' : 'them'
      } again`
    );
  }
  if (commands) {
    lines.push(
      ``,
      `To continue the run: ${commands.continueCommand}`,
      `To start fresh (deletes the run record, then runs the whole plan again): ${
        'command' in commands.startFresh
          ? commands.startFresh.command
          : `re-run this command with --start-fresh --run-id=${facts.runId}, keeping the --run-migrations argument, which names ${displayPath(
              commands.startFresh.migrationsPath
            )}; that path cannot be rendered as a command for this shell`
      }`
    );
  }
  return {
    title: `A migrate run is already active: ${facts.runId}`,
    bodyLines: lines.map(singleLine),
  };
}

// Prose, not a command, so a path goes out verbatim. A path with a line break
// goes out JSON-escaped: singleLine below would otherwise turn the break into
// a space and name a different path. JSON.stringify leaves U+0085, U+2028 and
// U+2029 literal, so those are escaped by hand.
function displayPath(migrationsPath: string): string {
  if (!hasLineBreak(migrationsPath)) {
    return migrationsPath;
  }
  return JSON.stringify(migrationsPath).replace(
    /[\u0085\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

// A null probe is 'unknown' on both sides: getGitCurrentBranch folds a
// detached HEAD and a failed git call into one null.
function branchLine(facts: ExistingRunFacts): string {
  const recorded = facts.recordedBranch ?? 'unknown';
  const current = facts.currentBranch ?? 'unknown';
  return recorded === current
    ? recorded
    : `started on ${recorded}, currently on ${current}`;
}

function commitsLine(commits: ExistingRunFacts['commits']): string {
  if (!commits.newest) {
    return 'none recorded';
  }
  const newest =
    commits.newest.sha === null
      ? 'newest recorded commit has no recorded sha and could not be checked'
      : `newest recorded commit ${commits.newest.sha.slice(0, 10)} is ${describeStatus(
          commits.newest.status
        )}`;
  const tally = `${commits.reachable} of ${commits.recorded} reachable${
    commits.unchecked > 0 ? `, ${commits.unchecked} could not be checked` : ''
  }`;
  return `${newest} (${tally})`;
}

function describeStatus(status: AncestorStatus): string {
  switch (status) {
    case 'ancestor':
      return 'reachable from HEAD';
    case 'not-ancestor':
      return 'not reachable from HEAD';
    case 'unknown':
      return 'of unknown reachability from HEAD';
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled ancestor status '${exhaustive}'.`);
    }
  }
}

function workersLine(workers: ExistingRunFacts['liveWorkers']): string {
  if (workers.length === 0) {
    return 'none running';
  }
  return workers
    .map((w) => `pid ${w.pid} is still running ${w.stepId} (${w.label})`)
    .join('; ');
}
