import { homedir } from 'os';
import { join } from 'path';
import { readYamlFile } from '../fileutils';

/**
 * Mirrors pnpm's getConfigDir. Hosts pnpm's global config.yaml and (v11+)
 * auth.ini.
 * See https://github.com/pnpm/pnpm/blob/b7195db5c8469c80908d625c648302b26c2f9977/config/reader/src/dirs.ts#L73-L92
 */
export function getPnpmConfigDir(env: NodeJS.ProcessEnv): string {
  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, 'pnpm');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library/Preferences/pnpm');
  }
  if (process.platform !== 'win32') {
    return join(homedir(), '.config/pnpm');
  }
  if (env.LOCALAPPDATA) {
    return join(env.LOCALAPPDATA, 'pnpm/config');
  }
  return join(homedir(), '.config/pnpm');
}

/**
 * Reads a pnpm YAML config file (pnpm-workspace.yaml or the global
 * config.yaml). An absent file returns null so callers can fall through to
 * lower surfaces; everything else returns 'unusable', which every caller turns
 * into a throw. pnpm's own reader tolerates ENOENT alone and rethrows the rest,
 * and it dies the same way on a document it cannot parse or that is not a
 * mapping, so the two failures need no separate states. Requiring an object
 * also keeps the sentinel out of the success domain: a returned string can only
 * ever mean unusable.
 */
export function readPnpmYamlConfig(
  path: string
): Record<string, unknown> | 'unusable' | null {
  let doc: unknown;
  try {
    doc = readYamlFile(path);
  } catch (e) {
    // Only ENOENT resolves on, so a path through a non-directory or a file that
    // will not open is fatal here. Callers whose pnpm counterpart looks the file
    // up before reading it widen "absent" themselves.
    if (e?.code === 'ENOENT') {
      return null;
    }
    return 'unusable';
  }
  // An empty file declares nothing; pnpm accepts it.
  if (doc === null || doc === undefined) {
    return {};
  }
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    return 'unusable';
  }
  return doc as Record<string, unknown>;
}
