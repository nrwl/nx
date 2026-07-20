// Internal to run/: deliberately not re-exported from ./index.

import { createHash } from 'crypto';
import { output } from '../../../utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';
import {
  getStringifiedPackageJsonDeps,
  logSkippedPostMigrationInstall,
  runInstall,
} from '../execute-migration';
import type { MigrateStep } from './run-state';

export function nowIso(): string {
  return new Date().toISOString();
}

// Dispensed commands use POSIX env-prefix syntax, invalid in both cmd.exe and
// PowerShell. Until Windows support lands, refuse up front rather than working
// on a run whose dispensed commands cannot execute. The remediation differs
// per entry point: init can fall back to the standard flow, but an existing
// run can only be continued off-Windows or abandoned (the standard flow cannot
// resume it, and a restart would re-apply finished migrations).
export function assertPlatformSupported(remediation: string): void {
  if (process.platform === 'win32') {
    throw new Error(
      `The orchestrated migrate flow is not supported on Windows yet. ${remediation}`
    );
  }
}

export const EXISTING_RUN_WINDOWS_REMEDIATION =
  'This run cannot be continued on Windows. Continue it from a non-Windows environment, or delete its directory under .nx/migrate-runs to abandon it; migrations it already applied remain applied.';

// Fingerprints the workspace dependencies so a step can persist what they
// looked like before it ran and a later attempt can still tell whether the
// migration changed them. Hashed rather than stored verbatim to keep run.json
// small; the value is only ever compared for equality.
export function depsHash(root: string): string {
  return createHash('sha256')
    .update(getStringifiedPackageJsonDeps(root))
    .digest('hex');
}

/**
 * Installs when the workspace dependencies differ from what the step's first
 * dispense recorded, so a prompt applied by another actor, or a retry that
 * only has the commit left to do, still installs what the changes need.
 * Comparing against the persisted baseline is what makes that possible: by the
 * time either runs, the edits are already on disk, so a snapshot taken here
 * would see them as the starting point and never detect a change.
 *
 * A step with no baseline (a structural step, or a run created before the
 * field existed) has nothing to compare against and installs nothing.
 */
export async function installDepsChangedSinceDispense(
  root: string,
  step: MigrateStep,
  skipInstall: boolean,
  rerunCommand?: string
): Promise<void> {
  if (
    step.depsHashAtDispense === undefined ||
    depsHash(root) === step.depsHashAtDispense
  ) {
    return;
  }
  if (skipInstall) {
    logSkippedPostMigrationInstall(root);
    return;
  }
  await runInstall(root, 'post-migration', rerunCommand);
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

const cachedPmExecPrefix = new Map<string, string>();

// getPackageManagerCommand can shell out to detect a version, so cache the
// result per root.
export function pmExecPrefix(root: string): string {
  let prefix = cachedPmExecPrefix.get(root);
  if (prefix === undefined) {
    prefix = getPackageManagerCommand(detectPackageManager(root), root).exec;
    cachedPmExecPrefix.set(root, prefix);
  }
  return prefix;
}
