import { randomBytes } from 'crypto';
import { renameSync } from 'fs';

/**
 * Runs `write` against a unique sibling temp path, then renames it over
 * `filePath`: a crash mid-write can only leave a stale temp file, never a
 * half-written artifact, and rename replaces whatever sits at the destination
 * without following it. The random suffix keeps concurrent writers apart; a
 * pid would collide across PID namespaces sharing the workspace.
 */
export function publishFileAtomically(
  filePath: string,
  write: (tmpPath: string) => void
): void {
  const tmpPath = `${filePath}~${randomBytes(4).toString('hex')}`;
  write(tmpPath);
  renameSync(tmpPath, filePath);
}
