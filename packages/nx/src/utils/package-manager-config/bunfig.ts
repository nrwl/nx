import { existsSync, readFileSync } from 'fs';

/**
 * The directory holding bun's global config files (.bunfig.toml and, for bun's
 * npmrc support, .npmrc): $XDG_CONFIG_HOME when set, else the home dir (mirrors
 * bun's getHomeConfigPath; when XDG_CONFIG_HOME is set the home dir is NOT
 * consulted). Returns null when neither is set, in which case bun reads no
 * global config.
 */
export function getBunGlobalConfigBase(env: NodeJS.ProcessEnv): string | null {
  // bun's getenvZ treats a set-but-empty var as present, so an exported empty
  // XDG_CONFIG_HOME short-circuits the home var (mirrors bun's `XDG_CONFIG_HOME
  // orelse HOME`, where orelse only fires when the var is absent).
  if (env.XDG_CONFIG_HOME !== undefined) {
    return env.XDG_CONFIG_HOME;
  }
  // bun's HOME accessor is platform-specific (env_var.zig): it reads USERPROFILE
  // on Windows and HOME elsewhere, so the global config base follows the same
  // per-platform home var rather than HOME alone.
  const home = process.platform === 'win32' ? env.USERPROFILE : env.HOME;
  return home ?? null;
}

/**
 * Parses a bunfig.toml. An absent file returns null; a file bun's own TOML
 * parser would reject returns 'invalid' (bun hard-errors on it, so callers
 * decide whether to defer or skip the surface).
 */
export function readBunfigRaw(
  path: string
): Record<string, unknown> | 'invalid' | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const { parse } = require('smol-toml') as typeof import('smol-toml');
    return parse(readFileSync(path, 'utf-8'));
  } catch {
    return 'invalid';
  }
}
