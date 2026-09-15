import { isAbsolute, relative, sep } from 'path';
import {
  cacheDirectoryForWorkspace,
  workspaceDataDirectoryForWorkspace,
} from '../utils/cache-directory';

// The walker already skips these on its own.
const WALKER_DEFAULTS = new Set(['.nx/cache', '.nx/workspace-data']);

/**
 * Workspace-relative directories a disk-backed fileset walk never enters: the
 * Nx cache and workspace-data locations when they sit inside the workspace
 * somewhere other than their default spots under `.nx`.
 */
export function diskWalkSkippedDirectories(workspaceRoot: string): string[] {
  const inside: string[] = [];
  for (const dir of [
    cacheDirectoryForWorkspace(workspaceRoot),
    workspaceDataDirectoryForWorkspace(workspaceRoot),
  ]) {
    const rel = relative(workspaceRoot, dir);
    if (
      rel &&
      rel !== '..' &&
      !rel.startsWith('..' + sep) &&
      !isAbsolute(rel)
    ) {
      const posix = rel.replace(/\\/g, '/');
      if (!WALKER_DEFAULTS.has(posix)) inside.push(posix);
    }
  }
  return inside;
}
