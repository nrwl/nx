import { join } from 'path';
import TOML from 'smol-toml';
import { Tree } from '../../generators/tree';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import {
  agentPluginsRepoUrl,
  claudePluginId,
  codexConfigTomlPath,
  codexPluginId,
  cursorPluginKey,
  cursorSettingsPath,
  opencodeMcpPath,
  opencodePluginPackage,
} from '../constants';
import type { Agent } from '../utils';
import {
  findLegacyAgentFiles,
  hasNxRulesBlock,
  legacyAgentFolders,
} from './legacy-agent-config';
import { legacyAgentFiles } from './legacy-agent-files';

// Reads and writes the workspace config that registers the Nx agent plugins,
// and the MCP entries older versions wrote before the plugins shipped them.

function readJsonOrUndefined(tree: Tree, path: string): any {
  if (!tree.isFile(path)) {
    return undefined;
  }
  try {
    return readJson(tree, path);
  } catch {
    return undefined;
  }
}

export function isClaudePluginEnabled(tree: Tree, directory: string): boolean {
  const settings = readJsonOrUndefined(
    tree,
    join(directory, '.claude', 'settings.json')
  );
  return !!settings?.enabledPlugins?.[claudePluginId];
}

// ── Cursor ──

function cursorPluginEntry(tree: Tree, directory: string): any {
  return readJsonOrUndefined(tree, cursorSettingsPath(directory))?.plugins?.[
    cursorPluginKey
  ];
}

export function hasCursorPlugin(tree: Tree, directory: string): boolean {
  return cursorPluginEntry(tree, directory)?.enabled === true;
}

export function readCursorPluginVersion(
  tree: Tree,
  directory: string
): string | null {
  const gitRef = cursorPluginEntry(tree, directory)?.gitRef;
  return typeof gitRef === 'string' && gitRef.startsWith('v')
    ? gitRef.slice(1)
    : null;
}

/**
 * Cursor installs project-scoped plugins listed in `.cursor/settings.json`
 * from a git URL at a pinned ref. Nx agent plugin releases are tagged
 * `v<version>`.
 */
export function writeCursorPlugin(
  tree: Tree,
  directory: string,
  version: string
): void {
  const path = cursorSettingsPath(directory);
  if (!tree.exists(path)) {
    writeJson(tree, path, {});
  }
  updateJson(tree, path, (json) => ({
    ...json,
    plugins: {
      ...json.plugins,
      [cursorPluginKey]: {
        ...json.plugins?.[cursorPluginKey],
        enabled: true,
        gitUrl: agentPluginsRepoUrl,
        gitRef: `v${version}`,
      },
    },
  }));
}

// ── OpenCode ──

const opencodePluginEntryPattern = new RegExp(
  `^${opencodePluginPackage.replace('/', '\\/')}(@.+)?$`
);

function opencodePluginSpecifier(entry: unknown): string | undefined {
  if (typeof entry === 'string') {
    return entry;
  }
  // Entries can also carry options: ["<package>", { ... }]
  if (Array.isArray(entry) && typeof entry[0] === 'string') {
    return entry[0];
  }
  return undefined;
}

function isNxOpencodePluginEntry(entry: unknown): boolean {
  const specifier = opencodePluginSpecifier(entry);
  return !!specifier && opencodePluginEntryPattern.test(specifier);
}

export function readOpencodePluginVersion(
  tree: Tree,
  directory: string
): string | null {
  const plugins = readJsonOrUndefined(tree, opencodeMcpPath(directory))?.plugin;
  if (!Array.isArray(plugins)) {
    return null;
  }
  for (const entry of plugins) {
    if (isNxOpencodePluginEntry(entry)) {
      const match = opencodePluginSpecifier(entry).match(
        opencodePluginEntryPattern
      );
      return match?.[1] ? match[1].slice(1) : null;
    }
  }
  return null;
}

export function hasOpencodePlugin(tree: Tree, directory: string): boolean {
  const plugins = readJsonOrUndefined(tree, opencodeMcpPath(directory))?.plugin;
  return Array.isArray(plugins) && plugins.some(isNxOpencodePluginEntry);
}

export function hasOpencodeNxMcp(tree: Tree, directory: string): boolean {
  return !!readJsonOrUndefined(tree, opencodeMcpPath(directory))?.mcp?.[
    'nx-mcp'
  ];
}

/**
 * Pins the Nx plugin in `opencode.json` (OpenCode installs npm plugins itself),
 * keeping an existing entry's position and options, and drops `nx-mcp`.
 */
export function writeOpencodePlugin(
  tree: Tree,
  directory: string,
  version: string
): void {
  const path = opencodeMcpPath(directory);
  if (!tree.exists(path)) {
    writeJson(tree, path, {});
  }
  updateJson(tree, path, (json) => {
    const specifier = `${opencodePluginPackage}@${version}`;
    const plugins: unknown[] = Array.isArray(json.plugin) ? json.plugin : [];
    const existing = plugins.findIndex(isNxOpencodePluginEntry);
    json.plugin =
      existing === -1
        ? [...plugins, specifier]
        : plugins.flatMap((entry, i) => {
            if (!isNxOpencodePluginEntry(entry)) {
              return [entry];
            }
            // Duplicate entries for the Nx plugin are dropped
            if (i !== existing) {
              return [];
            }
            return [
              Array.isArray(entry) ? [specifier, ...entry.slice(1)] : specifier,
            ];
          });
    if (json.mcp?.['nx-mcp']) {
      delete json.mcp['nx-mcp'];
      if (Object.keys(json.mcp).length === 0) {
        delete json.mcp;
      }
    }
    return json;
  });
}

// ── Codex ──

/**
 * Parsed `.codex/config.toml`: `{}` when the file doesn't exist, `undefined`
 * when it can't be parsed.
 */
export function readCodexConfig(
  tree: Tree,
  directory: string
): Record<string, any> | undefined {
  const path = codexConfigTomlPath(directory);
  if (!tree.isFile(path)) {
    return {};
  }
  try {
    return TOML.parse(tree.read(path, 'utf-8')) as Record<string, any>;
  } catch {
    return undefined;
  }
}

export function hasCodexPlugin(tree: Tree, directory: string): boolean {
  return (
    readCodexConfig(tree, directory)?.plugins?.[codexPluginId]?.enabled === true
  );
}

export function hasCodexNxMcp(tree: Tree, directory: string): boolean {
  return !!readCodexConfig(tree, directory)?.mcp_servers?.['nx-mcp'];
}

/**
 * Enables the Nx plugin in `.codex/config.toml`, dropping `nx-mcp` and entries
 * for removed copied subagents. Returns false, leaving the file untouched,
 * when it can't be parsed.
 */
export function writeCodexPlugin(tree: Tree, directory: string): boolean {
  const config = readCodexConfig(tree, directory);
  if (!config) {
    return false;
  }
  const original = JSON.stringify(config);

  config.plugins ??= {};
  config.plugins[codexPluginId] = {
    ...config.plugins[codexPluginId],
    enabled: true,
  };

  if (config.mcp_servers?.['nx-mcp']) {
    delete config.mcp_servers['nx-mcp'];
    if (Object.keys(config.mcp_servers).length === 0) {
      delete config.mcp_servers;
    }
  }

  if (config.agents && typeof config.agents === 'object') {
    for (const [name, agent] of Object.entries<any>(config.agents)) {
      const copiedPath = `.codex/agents/${name}.toml`;
      const pointsAtCopiedFile =
        agent?.config_file === `agents/${name}.toml` ||
        agent?.config_file === copiedPath;
      if (
        pointsAtCopiedFile &&
        copiedPath in legacyAgentFiles &&
        !tree.exists(join(directory, copiedPath))
      ) {
        delete config.agents[name];
      }
    }
    if (Object.keys(config.agents).length === 0) {
      delete config.agents;
    }
  }

  // Re-serializing drops the user's formatting and comments, so only rewrite
  // the file when its contents actually change.
  if (JSON.stringify(config) !== original) {
    tree.write(codexConfigTomlPath(directory), TOML.stringify(config));
  }
  return true;
}

// ── Setup detection ──

/** Whether the workspace has an Nx setup for the agent, old or new. */
export function hasAgentSetup(
  tree: Tree,
  directory: string,
  agent: Agent
): boolean {
  const hasLegacyFiles = (folders: readonly string[]) =>
    findLegacyAgentFiles(tree, directory, folders).length > 0;
  switch (agent) {
    case 'claude':
      return (
        isClaudePluginEnabled(tree, directory) ||
        hasNxRulesBlock(tree, join(directory, 'CLAUDE.md'))
      );
    case 'cursor':
      return (
        hasCursorPlugin(tree, directory) ||
        hasLegacyFiles(legacyAgentFolders.cursor)
      );
    case 'codex':
      return (
        hasCodexPlugin(tree, directory) ||
        hasCodexNxMcp(tree, directory) ||
        hasLegacyFiles(legacyAgentFolders.codex)
      );
    case 'opencode':
      return (
        hasOpencodePlugin(tree, directory) ||
        hasOpencodeNxMcp(tree, directory) ||
        hasLegacyFiles(legacyAgentFolders.opencode)
      );
  }
}
