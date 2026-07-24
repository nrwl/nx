// Small helpers shared by the worker and orchestrator. Not part of run/'s
// public surface (not re-exported via ./index): import directly within run/.

import { output } from '../../../utils/output';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';

export function nowIso(): string {
  return new Date().toISOString();
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
