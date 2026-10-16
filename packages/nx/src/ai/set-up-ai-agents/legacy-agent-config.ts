import { createHash } from 'crypto';
import { dirname, join, normalize } from 'path';
import { Tree } from '../../generators/tree';
import { readJson, updateJson } from '../../generators/utils/json';
import {
  agentsMdPath,
  claudeMdPath,
  geminiMdPath,
  geminiSettingsPath,
  rulesRegex,
} from '../constants';
import type { Agent } from '../utils';
import { legacyAgentFiles } from './legacy-agent-files';

/**
 * Workspace folders that older versions of `nx configure-ai-agents` copied
 * files into, per owner. `.agents` holds skills shared by Codex, Cursor and
 * Gemini.
 */
export const legacyAgentFolders = {
  codex: ['.codex/agents'],
  copilot: ['.github'],
  cursor: ['.cursor'],
  gemini: ['.gemini'],
  opencode: ['.opencode'],
  sharedSkills: ['.agents'],
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

export type NxRulesFile = {
  path: string;
  /** The agents that read this file. */
  owners: Agent[];
};

function readGeminiContextFileName(
  tree: Tree,
  directory: string
): string | undefined {
  const settingsPath = geminiSettingsPath(directory);
  if (!tree.isFile(settingsPath)) {
    return undefined;
  }
  try {
    const contextFileName = readJson(tree, settingsPath).contextFileName;
    return typeof contextFileName === 'string' ? contextFileName : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Rules files that still contain the Nx guidelines block older versions of
 * `nx configure-ai-agents` wrote, with the agents that read each file.
 */
export function findNxRulesFiles(tree: Tree, directory: string): NxRulesFile[] {
  const owners = new Map<string, Set<Agent>>();
  const addOwners = (path: string, agents: Agent[]) => {
    const key = normalize(path);
    owners.set(key, new Set([...(owners.get(key) ?? []), ...agents]));
  };
  addOwners(agentsMdPath(directory), [
    'codex',
    'cursor',
    'opencode',
    'copilot',
  ]);
  addOwners(claudeMdPath(directory), ['claude']);
  addOwners(geminiMdPath(directory), ['gemini']);
  const contextFileName = readGeminiContextFileName(tree, directory);
  if (contextFileName) {
    addOwners(join(directory, contextFileName), ['gemini']);
  }

  return [...owners]
    .filter(([path]) => hasNxRulesBlock(tree, path))
    .map(([path, agents]) => ({ path, owners: [...agents] }));
}

/**
 * Removes the Nx guidelines block from a rules file, deleting the file when
 * nothing else is left in it.
 */
export function removeNxRulesBlock(tree: Tree, path: string): void {
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
 * Older versions pointed Gemini at AGENTS.md for the Nx guidelines. Once that
 * file is gone, the setting points nowhere and is dropped.
 */
export function removeDanglingGeminiContextFile(
  tree: Tree,
  directory: string
): void {
  if (
    readGeminiContextFileName(tree, directory) === 'AGENTS.md' &&
    !tree.exists(agentsMdPath(directory))
  ) {
    updateJson(tree, geminiSettingsPath(directory), (json) => {
      delete json.contextFileName;
      return json;
    });
  }
}

export function hasNxRulesBlock(tree: Tree, path: string): boolean {
  return tree.isFile(path) && rulesRegex.test(tree.read(path, 'utf-8'));
}
