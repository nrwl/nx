import { join } from 'path';
import { NX_TMP_DIR_POSIX } from '../utils/nx-tmp-dir';

export function agentsMdPath(root: string): string {
  return join(root, 'AGENTS.md');
}

export function geminiMdPath(root: string): string {
  return join(root, 'GEMINI.md');
}

export function geminiSettingsPath(root: string): string {
  return join(root, '.gemini', 'settings.json');
}

export function claudeMdPath(root: string): string {
  return join(root, 'CLAUDE.md');
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

export function cursorSettingsPath(root: string): string {
  return join(root, '.cursor', 'settings.json');
}

// Markers around the Nx guidelines block older versions wrote into rules
// files, kept only to find and remove those blocks.
export const nxRulesMarkerCommentStart = `<!-- nx configuration start-->`;
export const nxRulesMarkerCommentEnd = `<!-- nx configuration end-->`;
export const rulesRegex = new RegExp(
  `${nxRulesMarkerCommentStart}[\\s\\S]*?${nxRulesMarkerCommentEnd}`,
  'm'
);

// The Nx agent plugins are released from this repository: the npm packages
// below share one version, and each release is tagged `v<version>`.
export const agentPluginsRepoUrl =
  'https://github.com/nrwl/nx-ai-agents-config.git';
/** The package whose `latest` version determines which plugin version to pin. */
export const claudePluginPackage = '@nx/claude-plugin';
export const codexPluginPackage = '@nx/codex-plugin';
export const opencodePluginPackage = '@nx/opencode-plugin';

/** Claude Code plugin id, served by the marketplace in agentPluginsRepoUrl. */
export const claudePluginId = 'nx@nx-claude-plugins';
/** Codex plugin id, from the marketplace the @nx/codex-plugin installer registers. */
export const codexPluginId = 'nx@nx-agent-plugins';
export const codexPluginMarketplace = 'nx-agent-plugins';
/** Key of the project-scoped plugin entry in Cursor's .cursor/settings.json. */
export const cursorPluginKey = 'nx-agent-plugins/nx';

/**
 * Hostname Nx analytics events are sent to (GA4 Measurement Protocol).
 * Must stay in sync with GA_ENDPOINT in packages/nx/src/native/telemetry/constants.rs.
 */
export const analyticsDomain = 'www.google-analytics.com';

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
