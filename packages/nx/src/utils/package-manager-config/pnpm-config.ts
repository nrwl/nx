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
 * lower surfaces; a file that exists but cannot be read returns 'unreadable',
 * which pnpm resolves through; a corrupt or non-object one returns 'invalid',
 * which pnpm dies on. Requiring an object also keeps the sentinels out of the
 * success domain: a returned string can only ever mean one of them.
 */
export function readPnpmYamlConfig(
  path: string
): Record<string, unknown> | 'unreadable' | 'invalid' | null {
  let doc: unknown;
  try {
    doc = readYamlFile(path);
  } catch (e) {
    // Classified from the read itself rather than a preceding existence check,
    // which would report a file deleted in between as malformed. ENOTDIR (a path
    // through a non-directory) is another shape of absent.
    if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') {
      return null;
    }
    // EISDIR alone is fatal: pnpm 11.20 aborts on it where 11.5 and 10.33 skip
    // the file, and pinning the newest keeps a directory from reading as config.
    if (e?.code && e.code !== 'EISDIR') {
      return 'unreadable';
    }
    // No errno means the parser rejected the bytes, not the filesystem.
    return 'invalid';
  }
  // An empty file declares nothing; pnpm accepts it.
  if (doc === null || doc === undefined) {
    return {};
  }
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    return 'invalid';
  }
  return doc as Record<string, unknown>;
}
