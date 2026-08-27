import type { ChildProcess } from 'node:child_process';
import { killProcessTree } from '../native';

// Children spawned by this process that must not outlive it. Plugin workers
// are torn down with `process.exit`, which leaves spawned build tools (gradle,
// maven, ...) orphaned and still holding their project locks.
const trackedChildren = new Set<number>();
let exitHookRegistered = false;

/**
 * Kill `cp` (and its descendants) when this process exits, unless it has
 * already exited on its own.
 */
export function killChildOnHostExit(cp: ChildProcess): void {
  if (!cp.pid) return;
  trackedChildren.add(cp.pid);
  const untrack = () => {
    trackedChildren.delete(cp.pid);
    // Whichever fires first, drop both — otherwise the other stays registered
    // on a child that is already gone.
    cp.off('exit', untrack);
    cp.off('error', untrack);
  };
  cp.once('exit', untrack);
  cp.once('error', untrack);
  if (!exitHookRegistered) {
    exitHookRegistered = true;
    process.once('exit', killTrackedChildren);
  }
}

export function killTrackedChildren(): void {
  for (const pid of trackedChildren) {
    try {
      // 'exit' handlers must be synchronous, so no graceful variant here.
      killProcessTree(pid, 'SIGTERM');
    } catch {}
  }
  trackedChildren.clear();
}
