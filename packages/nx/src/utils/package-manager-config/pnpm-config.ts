import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getHomeDir } from './home';

/**
 * pnpm's getConfigDir: XDG_CONFIG_HOME, else the per-platform default. Hosts
 * pnpm's global config.yaml and (v11+) auth.ini.
 */
export function getPnpmConfigDir(env: NodeJS.ProcessEnv): string {
  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, 'pnpm');
  }
  if (process.platform === 'darwin') {
    return join(getHomeDir(), 'Library/Preferences/pnpm');
  }
  if (process.platform !== 'win32') {
    return join(getHomeDir(), '.config/pnpm');
  }
  if (env.LOCALAPPDATA) {
    return join(env.LOCALAPPDATA, 'pnpm/config');
  }
  return join(getHomeDir(), '.config/pnpm');
}

/**
 * Reads a pnpm YAML config file (pnpm-workspace.yaml or the global
 * config.yaml). An absent file returns null so callers can fall through to
 * lower surfaces; a corrupt one returns 'invalid' so callers can decide
 * whether to defer (cooldown policy) or skip the surface (registry bridging).
 */
export function readPnpmYamlConfig(
  path: string
): Record<string, unknown> | 'invalid' | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const { load } = require('@zkochan/js-yaml');
    return (load(readFileSync(path, 'utf-8')) as Record<string, unknown>) ?? {};
  } catch {
    return 'invalid';
  }
}
