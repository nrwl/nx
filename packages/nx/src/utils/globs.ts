import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from './is-on-daemon';
import { globWithWorkspaceContext } from './workspace-context';
import { workspaceRoot } from './workspace-root';

export function combineGlobPatterns(...patterns: (string | string[])[]) {
  const p = patterns.flat();
  return p.length > 1 ? '{' + p.join(',') + '}' : p.length === 1 ? p[0] : '';
}

export async function globAsync(globs: string[], exclude?: string[]) {
  if (isOnDaemon() || !daemonClient.enabled()) {
    return globWithWorkspaceContext(workspaceRoot, globs, exclude);
  } else {
    return daemonClient.glob(globs, exclude);
  }
}
