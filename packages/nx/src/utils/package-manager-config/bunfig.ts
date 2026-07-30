import { readFileSync } from 'fs';

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
 * Parses a bunfig.toml. An absent file returns null and one that cannot be
 * read returns 'unreadable' (bun silently resolves without it, so most callers
 * collapse the two); a file bun's own TOML parser would reject returns
 * 'invalid' (bun hard-errors on that alone, so there is no resolution left for
 * a caller to reproduce). Both measured on bun 1.3.13: a directory or
 * mode-000 bunfig is skipped and the next config file is still read, while a
 * syntax error aborts before any request goes out.
 */
export function readBunfigRaw(
  path: string
): Record<string, unknown> | 'unreadable' | 'invalid' | null {
  // Outside the try: a parser that will not load is a broken installation, not
  // a corrupt workspace file, and reporting it as one would blame every bunfig.
  const { parse } = require('smol-toml') as typeof import('smol-toml');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (error) {
    return error?.code === 'ENOENT' ? null : 'unreadable';
  }
  try {
    return parse(raw);
  } catch {
    return 'invalid';
  }
}
