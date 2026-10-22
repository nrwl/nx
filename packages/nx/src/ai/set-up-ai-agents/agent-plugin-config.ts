import { join } from 'path';
import TOML from 'smol-toml';
import { Tree } from '../../generators/tree';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import {
  agentPluginsDistTag,
  agentPluginsDistTags,
  agentPluginsGitRef,
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

/**
 * The git ref Claude Code and Cursor read the plugin from. Unset or a channel
 * branch (`dist/<dist-tag>`) becomes the channel workspaces follow; any other
 * ref, such as a release tag, was set by the workspace and is kept.
 */
export function agentPluginsGitRefFor(existing: unknown): string {
  return typeof existing === 'string' && !existing.startsWith('dist/')
    ? existing
    : agentPluginsGitRef;
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

/**
 * Cursor installs project-scoped plugins listed in `.cursor/settings.json`
 * from a git URL and ref, see agentPluginsGitRefFor.
 */
export function writeCursorPlugin(tree: Tree, directory: string): void {
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
        gitRef: agentPluginsGitRefFor(json.plugins?.[cursorPluginKey]?.gitRef),
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

const opencodePluginSpecifierForChannel =
  agentPluginsDistTag === 'latest'
    ? opencodePluginPackage
    : `${opencodePluginPackage}@${agentPluginsDistTag}`;

function followsChannel(specifier: string): boolean {
  const version = specifier.slice(opencodePluginPackage.length + 1);
  return (
    version === '' ||
    (agentPluginsDistTags as readonly string[]).includes(version)
  );
}

function isNxOpencodePluginEntry(entry: unknown): boolean {
  const specifier = opencodePluginSpecifier(entry);
  return !!specifier && opencodePluginEntryPattern.test(specifier);
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
 * Adds the Nx plugin to `opencode.json` at the channel's dist-tag, which
 * OpenCode resolves itself, and drops `nx-mcp`. An entry on a dist-tag is
 * moved to the channel workspaces follow; one pinned to a version the
 * workspace set itself is kept.
 */
export function writeOpencodePlugin(tree: Tree, directory: string): void {
  const path = opencodeMcpPath(directory);
  if (!tree.exists(path)) {
    writeJson(tree, path, {});
  }
  updateJson(tree, path, (json) => {
    const plugins: unknown[] = Array.isArray(json.plugin) ? json.plugin : [];
    const existing = plugins.findIndex(isNxOpencodePluginEntry);
    const entry = plugins[existing];
    if (existing === -1) {
      json.plugin = [...plugins, opencodePluginSpecifierForChannel];
    } else {
      const updated = !followsChannel(opencodePluginSpecifier(entry))
        ? entry
        : Array.isArray(entry)
          ? [opencodePluginSpecifierForChannel, ...entry.slice(1)]
          : opencodePluginSpecifierForChannel;
      // Duplicate entries for the Nx plugin are dropped
      json.plugin = plugins
        .map((plugin, i) => (i === existing ? updated : plugin))
        .filter(
          (plugin, i) => !isNxOpencodePluginEntry(plugin) || i === existing
        );
    }
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
