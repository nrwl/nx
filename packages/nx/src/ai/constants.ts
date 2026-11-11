import { join } from 'path';
import { major } from 'semver';
import { readJsonFile } from '../utils/fileutils';
import { NX_TMP_DIR_POSIX } from '../utils/nx-tmp-dir';

export function parseGeminiSettings(root: string): any | undefined {
  const settingsPath = geminiSettingsPath(root);
  try {
    return readJsonFile(settingsPath);
  } catch {
    return undefined;
  }
}

export function geminiSettingsPath(root: string): string {
  return join(root, '.gemini', 'settings.json');
}

export function claudeMcpJsonPath(root: string): string {
  return join(root, '.mcp.json');
}

export function opencodeMcpPath(root: string): string {
  return join(root, 'opencode.json');
}

export function codexConfigTomlPath(root: string): string {
  return join(root, '.codex', 'config.toml');
}

/**
 * Hostname Nx analytics events are sent to (GA4 Measurement Protocol).
 * Must stay in sync with GA_ENDPOINT in packages/nx/src/native/telemetry/constants.rs.
 */
export const analyticsDomain = 'www.google-analytics.com';

export const nxMcpTomlHeader = `[mcp_servers."nx-mcp"]`;

/**
 * Get the MCP TOML configuration based on the Nx version.
 * For Nx 22+, uses 'nx mcp'
 * For Nx < 22, uses 'nx-mcp'
 */
export function getNxMcpTomlConfig(nxVersion: string): string {
  const majorVersion = major(nxVersion);
  const args = majorVersion >= 22 ? '["nx", "mcp"]' : '["nx-mcp"]';
  return `${nxMcpTomlHeader}
type = "stdio"
command = "npx"
args = ${args}
`;
}

/**
 * The Nx runtime roots as they belong in a *committed* sandbox allowlist.
 *
 * `~/.nx` is the literal tilde rather than an expanded `NX_HOME_TMP_DIR`: the
 * sandbox expands it per user, which is the property that makes the entry worth
 * committing at all. An absolute home would pin the file to whoever ran the
 * generator.
 *
 * Both are listed because socket resolution walks a chain — `/tmp/.nx` first,
 * `~/.nx` when a peer already owns the shared container. Allowing only the first
 * leaves every user on a machine where someone else got there first silently
 * uncovered. Windows resolves `NX_TMP_DIR` to a machine-specific `%TMP%` and has
 * no sandbox to configure, so the POSIX root is the one that belongs here.
 */
export const NX_ALLOWLIST_ROOTS = [NX_TMP_DIR_POSIX, '~/.nx'] as const;
