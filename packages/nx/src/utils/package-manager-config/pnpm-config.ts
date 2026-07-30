import { existsSync } from 'fs';
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
 * lower surfaces; a corrupt or non-object one returns 'invalid' so a caller can
 * tell malformed config from an absent file (pnpm dies on both alike).
 * Requiring an object also keeps the sentinel out of the success domain, so a
 * yaml whose whole content is the scalar `invalid` reports as malformed rather
 * than as that string.
 */
export function readPnpmYamlConfig(
  path: string
): Record<string, unknown> | 'invalid' | null {
  if (!existsSync(path)) {
    return null;
  }
  let doc: unknown;
  try {
    doc = readYamlFile(path);
  } catch {
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
