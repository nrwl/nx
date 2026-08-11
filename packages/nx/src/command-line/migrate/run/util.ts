// Internal to run/: deliberately not re-exported from ./index.

import { createHash } from 'crypto';
import { output } from '../../../utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';
import {
  logSkippedPostMigrationInstall,
  readPackageJsonDeps,
  runInstall,
} from '../execute-migration';
import type { MigrateStep } from './run-state';
import { updateRunState } from './state-lock';

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Collapses every character a reader could take for a line break, so a value
 * cannot break out of the line it is rendered on. The driving agent scans this
 * same stdout for `<nx_migrate_*>` blocks, which are framed by a bare newline,
 * so a value carrying its own break could open a forged one at a line start.
 *
 * U+0085, U+2028 and U+2029 are in the set because "line start" is the
 * reader's notion, not this process's: a JavaScript `^` under `/m` treats the
 * latter two as terminators, and Nx does not know what parses its output.
 *
 * For values Nx does not author: a migration's summary or next steps, a
 * handoff an agent wrote, a persisted run-state string. Every other character
 * is kept, only the line structure is not.
 */
export function singleLine(value: string): string {
  return value.replace(/[\x00-\x1f\x7f\u0085\u2028\u2029]+/g, ' ');
}

/**
 * Fingerprints the workspace dependencies so a step can persist what they
 * looked like and a later actor can still tell whether the migration changed
 * them. Hashed rather than stored verbatim to keep run.json small; the value
 * is only ever compared for equality.
 *
 * `null` means the probe itself failed. Callers must not read that as
 * "unchanged": the value is persisted and compared across processes, so a
 * failed read on either end would otherwise silently skip an install that was
 * needed.
 */
export function depsHash(root: string): string | null {
  const deps = readPackageJsonDeps(root);
  return deps === null ? null : createHash('sha256').update(deps).digest('hex');
}

/**
 * Installs when the workspace dependencies differ from the step's recorded
 * baseline, so a prompt applied by another actor, or a retry that only has the
 * commit left to do, still installs what the changes need. Comparing against
 * the persisted baseline is what makes that possible: by the time either runs,
 * the edits are already on disk, so a snapshot taken here would see them as
 * the starting point and never detect a change.
 *
 * The baseline is re-pointed at the current dependencies once the install
 * lands, so the next actor to compare does not install the same change again.
 *
 * Every probe failure installs, on either end of the comparison. A step whose
 * dispense-time probe failed has no baseline, which says the dependencies it
 * started from are unknown rather than unchanged, and skipping there would
 * strand the change with nothing left to detect it.
 */
export async function installDepsChangedSinceDispense(
  root: string,
  dir: string,
  step: MigrateStep,
  skipInstall: boolean,
  rerunCommand?: string
): Promise<void> {
  const current = depsHash(root);
  if (current !== null && current === step.depsHashAtDispense) return;
  if (skipInstall) {
    logSkippedPostMigrationInstall(root);
    return;
  }
  await runInstall(root, 'post-migration', rerunCommand);
  recordInstallLanded(root, dir, step.id);
}

/**
 * Records what an install that just landed means for the run: the installing
 * step's dependency baseline moves to what is now on disk, and every step's
 * install-failure mark clears.
 *
 * The baseline has to move, or the next actor to compare (the prompt fold, a
 * retry, the step's own commit) reads the step's own edits as an unapplied
 * change and pays a second full install. The marks clear because the package
 * manager installs the whole workspace package.json, so this install also
 * covers the dependency edits of every earlier step that failed to install its
 * own.
 *
 * A failed probe leaves the baseline alone: an install that runs twice costs
 * time, one that never runs leaves the workspace inconsistent with its
 * package.json.
 *
 * Never throws. It runs inside callers that treat a throw as "the install
 * failed", and the install has already succeeded by then. A run state this
 * cannot read or write is a real problem, but it is reported by the next
 * mandatory write rather than misattributed here, and the only cost of losing
 * this one is a redundant install later.
 */
export function recordInstallLanded(
  root: string,
  dir: string,
  stepId: string
): void {
  const hash = depsHash(root);
  try {
    updateRunState(dir, (fresh) => {
      const baselineMoves = fresh.steps.some(
        (s) => s.id === stepId && hash !== null && s.depsHashAtDispense !== hash
      );
      if (!baselineMoves && !fresh.steps.some((s) => s.installFailed)) {
        return null;
      }
      return {
        ...fresh,
        steps: fresh.steps.map(({ installFailed, ...s }) =>
          s.id === stepId && baselineMoves
            ? { ...s, depsHashAtDispense: hash }
            : s
        ),
      };
    });
  } catch {
    // See above: the install already succeeded, so a state failure here must
    // not be reported as an install failure.
  }
}

// ESRCH means the process is gone; EPERM means it exists but isn't ours (alive).
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// The agent reads this to decide retry-vs-skip, so keep it to the error's
// first line and bound the length rather than dumping a multi-line stack.
export function summarizeError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const firstLine = message.split('\n')[0].trim();
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}

// The commit helper reports its own failures via the result status and logs
// the details itself; `cause` is set only when the attempt threw instead
// (the pre-commit dependency install), which nothing else has logged.
export function warnCommitFailed(name: string, cause?: unknown): void {
  const causeText = cause === undefined ? '' : ` (${summarizeError(cause)})`;
  output.warn({
    title: `The commit for ${name} could not be created${causeText}; its changes remain in the working tree for a later commit to absorb.`,
  });
}

const cachedPmCommands = new Map<
  string,
  ReturnType<typeof getPackageManagerCommand>
>();

// getPackageManagerCommand can shell out to detect a version, so cache the
// result per root.
function pmCommands(root: string): ReturnType<typeof getPackageManagerCommand> {
  let commands = cachedPmCommands.get(root);
  if (commands === undefined) {
    commands = getPackageManagerCommand(detectPackageManager(root), root);
    cachedPmCommands.set(root, commands);
  }
  return commands;
}

export function pmExecPrefix(root: string): string {
  return pmCommands(root).exec;
}

export function pmInstallCommand(root: string): string {
  return pmCommands(root).install;
}
