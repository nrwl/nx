import { createHash } from 'crypto';
import { dirname, join, normalize } from 'path';
import { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import {
  agentsMdPath,
  claudeMdPath,
  geminiMdPath,
  geminiSettingsPath,
  rulesRegex,
} from '../constants';
import { legacyAgentFiles } from './legacy-agent-files';

/**
 * Workspace folders older versions of `nx configure-ai-agents` copied files
 * into. `unsupported` holds copies for Copilot and Gemini, which nx no longer
 * configures, and the skills Codex, Cursor and Gemini shared in `.agents`.
 */
export const legacyAgentFolders = {
  codex: ['.codex/agents'],
  cursor: ['.cursor'],
  opencode: ['.opencode'],
  unsupported: ['.github', '.gemini', '.agents'],
} as const;

/**
 * Identifies a copied file's version regardless of formatter changes. Must
 * match fingerprintAgentFile in scripts/generate-legacy-ai-agent-files.mjs.
 */
export function fingerprintAgentFile(content: string): string {
  return createHash('sha256')
    .update(content.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .digest('hex')
    .slice(0, 16);
}

function legacyPathsIn(folders: readonly string[]): string[] {
  return Object.keys(legacyAgentFiles).filter((path) =>
    folders.some((folder) => path.startsWith(`${folder}/`))
  );
}

/**
 * Workspace-relative paths of previously copied files that still exist,
 * whether or not they were edited since.
 */
export function findLegacyAgentFiles(
  tree: Tree,
  directory: string,
  folders: readonly string[]
): string[] {
  return legacyPathsIn(folders).filter((path) =>
    tree.isFile(join(directory, path))
  );
}

export type LegacyAgentFilesCleanup = {
  removed: string[];
  /** Copied files that were edited after copying, so they are left in place. */
  kept: string[];
};

/**
 * Deletes files that older versions of `nx configure-ai-agents` copied into
 * the given folders, as long as they still match a version that was shipped.
 * Folders left empty are removed as well.
 */
export function removeLegacyAgentFiles(
  tree: Tree,
  directory: string,
  folders: readonly string[]
): LegacyAgentFilesCleanup {
  const removed: string[] = [];
  const kept: string[] = [];
  for (const path of findLegacyAgentFiles(tree, directory, folders)) {
    const fullPath = join(directory, path);
    const fingerprint = fingerprintAgentFile(tree.read(fullPath, 'utf-8'));
    if (legacyAgentFiles[path].includes(fingerprint)) {
      tree.delete(fullPath);
      removed.push(path);
    } else {
      kept.push(path);
    }
  }

  const root = normalize(directory);
  for (const path of removed) {
    let dir = dirname(join(directory, path));
    while (
      normalize(dir) !== root &&
      dir !== '.' &&
      tree.children(dir).length === 0
    ) {
      tree.delete(dir);
      dir = dirname(dir);
    }
  }

  return { removed, kept };
}

function readGeminiSettings(tree: Tree, directory: string): any {
  const settingsPath = geminiSettingsPath(directory);
  if (!tree.isFile(settingsPath)) {
    return undefined;
  }
  try {
    return readJson(tree, settingsPath);
  } catch {
    return undefined;
  }
}

/**
 * Removes the Nx guidelines block from a rules file, deleting the file when
 * nothing else is left in it.
 */
function removeNxRulesBlock(tree: Tree, path: string): void {
  let content = tree.read(path, 'utf-8');
  let match: RegExpExecArray | null;
  while ((match = rulesRegex.exec(content))) {
    const before = content.slice(0, match.index).replace(/\s+$/, '');
    const after = content
      .slice(match.index + match[0].length)
      .replace(/^\s+/, '');
    content = before && after ? `${before}\n\n${after}` : before || after;
  }
  if (content.trim() === '') {
    tree.delete(path);
  } else {
    tree.write(path, `${content.replace(/\s+$/, '')}\n`);
  }
}

/**
 * Removes every Nx guidelines block older versions wrote into AGENTS.md,
 * CLAUDE.md, GEMINI.md or the file Gemini's `contextFileName` points to.
 */
function removeNxRulesBlocks(tree: Tree, directory: string): void {
  const contextFileName = readGeminiSettings(tree, directory)?.contextFileName;
  const candidates = new Set(
    [
      agentsMdPath(directory),
      claudeMdPath(directory),
      geminiMdPath(directory),
      typeof contextFileName === 'string'
        ? join(directory, contextFileName)
        : undefined,
    ]
      .filter((path): path is string => !!path)
      .map((path) => normalize(path))
  );
  for (const path of candidates) {
    if (hasNxRulesBlock(tree, path)) {
      removeNxRulesBlock(tree, path);
    }
  }
}

/**
 * Removes what older versions wrote into `.gemini/settings.json`: the `nx-mcp`
 * server, and a `contextFileName` pointing at an AGENTS.md they wrote.
 */
function removeGeminiSetup(
  tree: Tree,
  directory: string,
  agentsMdHadNxBlock: boolean
): void {
  const settingsPath = geminiSettingsPath(directory);
  const settings = readGeminiSettings(tree, directory);
  if (!settings) {
    return;
  }
  const original = JSON.stringify(settings);
  if (settings.mcpServers?.['nx-mcp']) {
    delete settings.mcpServers['nx-mcp'];
    if (Object.keys(settings.mcpServers).length === 0) {
      delete settings.mcpServers;
    }
  }
  if (
    settings.contextFileName === 'AGENTS.md' &&
    (agentsMdHadNxBlock || !tree.exists(agentsMdPath(directory)))
  ) {
    delete settings.contextFileName;
  }
  if (JSON.stringify(settings) === original) {
    return;
  }
  if (Object.keys(settings).length === 0) {
    tree.delete(settingsPath);
    if (tree.children(dirname(settingsPath)).length === 0) {
      tree.delete(dirname(settingsPath));
    }
  } else {
    writeJson(tree, settingsPath, settings);
  }
}

/**
 * Whether the workspace still has a Copilot or Gemini setup from an older
 * version of `nx configure-ai-agents`.
 */
export function hasUnsupportedAgentSetup(
  tree: Tree,
  directory: string
): boolean {
  return (
    !!readGeminiSettings(tree, directory)?.mcpServers?.['nx-mcp'] ||
    findLegacyAgentFiles(tree, directory, ['.github', '.gemini']).length > 0
  );
}

/**
 * Removes what older versions wrote for every agent regardless of which agents
 * are being configured: Nx guidelines blocks in rules files, and the Copilot,
 * Gemini and shared `.agents` setups nx no longer maintains.
 */
export function removeLegacyNxSetup(
  tree: Tree,
  directory: string
): LegacyAgentFilesCleanup {
  const agentsMdHadNxBlock = hasNxRulesBlock(tree, agentsMdPath(directory));
  removeNxRulesBlocks(tree, directory);
  removeGeminiSetup(tree, directory, agentsMdHadNxBlock);
  return removeLegacyAgentFiles(
    tree,
    directory,
    legacyAgentFolders.unsupported
  );
}

export function hasNxRulesBlock(tree: Tree, path: string): boolean {
  return tree.isFile(path) && rulesRegex.test(tree.read(path, 'utf-8'));
}
