import { readFileSync } from 'fs';

/**
 * The directory holding bun's global config files (.bunfig.toml and, for bun's
 * npmrc support, .npmrc): $XDG_CONFIG_HOME when set, else the home dir (bun's
 * getHomeConfigPath). Null when neither is set, where bun reads no global
 * config.
 */
export function getBunGlobalConfigBase(env: NodeJS.ProcessEnv): string | null {
  // bun's getenvZ treats a set-but-empty var as present, so an exported empty
  // XDG_CONFIG_HOME still short-circuits HOME (bun: `XDG_CONFIG_HOME orelse HOME`).
  if (env.XDG_CONFIG_HOME !== undefined) {
    return env.XDG_CONFIG_HOME;
  }
  // Mirrors bun's platform-specific HOME accessor (env_var.zig).
  const home = process.platform === 'win32' ? env.USERPROFILE : env.HOME;
  return home ?? null;
}

/**
 * Parses a bunfig.toml: null when absent, 'unreadable' when it cannot be read
 * (bun skips it and resolves on, so most callers collapse the two), 'invalid'
 * when bun's own TOML parser would reject it (bun hard-errors there, so no
 * resolution is left for a caller to reproduce).
 */
export function readBunfigRaw(
  path: string
): Record<string, unknown> | 'unreadable' | 'invalid' | null {
  // Outside the try because a parser that will not load is a broken
  // installation, not a corrupt bunfig.
  const { parse } = require('smol-toml') as typeof import('smol-toml');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (error) {
    // ENOTDIR (a path through a non-directory) is another shape of absent, the
    // same way the .npmrc reader classifies it.
    return error?.code === 'ENOENT' || error?.code === 'ENOTDIR'
      ? null
      : 'unreadable';
  }
  try {
    return parse(raw);
  } catch {
    return 'invalid';
  }
}
