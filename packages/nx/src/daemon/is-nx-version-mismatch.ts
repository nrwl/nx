import { existsSync } from 'fs';
import { join } from 'path';
import { readJsonFile } from '../utils/fileutils';
import { getNxRequirePaths } from '../utils/installation-directory';
import { getInstalledNxVersion } from '../utils/installed-nx-version';
import { nxVersion } from '../utils/versions';
import { workspaceRoot } from '../utils/workspace-root';

/**
 * Read `node_modules/nx/package.json` by its literal path along
 * `getNxRequirePaths()`, so the filesystem follows the current link on every
 * check. Node's module resolver keeps the real path it first resolved, even
 * when `Module._pathCache` is cleared, so a long-lived daemon asking through
 * the resolver keeps seeing the old version after a package manager re-points
 * `node_modules/nx` (as pnpm does on upgrade). Returns `null` when there is no
 * `node_modules/nx`, as under Yarn PnP.
 */
function readLinkedNxVersion(): string | null {
  for (const dir of getNxRequirePaths(workspaceRoot)) {
    const packageJsonPath = join(dir, 'node_modules', 'nx', 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        return (
          readJsonFile<{ version?: string }>(packageJsonPath).version ?? null
        );
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function isNxVersionMismatch(): boolean {
  return (readLinkedNxVersion() ?? getInstalledNxVersion()) !== nxVersion;
}
