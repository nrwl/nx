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
 * Identifies a version of a copied file independently of formatting: copied
 * files went through the workspace formatter, which only changes whitespace and
 * punctuation. Must match fingerprintAgentFile in
 * scripts/generate-legacy-ai-agent-files.mjs.
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

/**
 * Removes the Nx guidelines block that older versions of
 * `nx configure-ai-agents` wrote into AGENTS.md, CLAUDE.md, GEMINI.md or the
 * file Gemini's `contextFileName` points to. A file that held nothing but that
 * block is deleted. Returns the workspace-relative paths that changed.
 */
export function removeNxRulesBlocks(tree: Tree, directory: string): string[] {
  const geminiSettings = geminiSettingsPath(directory);
  let contextFileName: unknown;
  if (tree.exists(geminiSettings)) {
    try {
      contextFileName = readJson(tree, geminiSettings).contextFileName;
    } catch {
      // An unreadable settings file has no context file to clean up.
    }
  }

  const candidates = new Set([
    agentsMdPath(directory),
    claudeMdPath(directory),
    geminiMdPath(directory),
  ]);
  if (typeof contextFileName === 'string') {
    candidates.add(join(directory, contextFileName));
  }

  const changed: string[] = [];
  for (const path of candidates) {
    if (!tree.isFile(path)) {
      continue;
    }
    const original = tree.read(path, 'utf-8');
    let content = original;
    let match: RegExpExecArray | null;
    while ((match = rulesRegex.exec(content))) {
      const before = content.slice(0, match.index).replace(/\s+$/, '');
      const after = content
        .slice(match.index + match[0].length)
        .replace(/^\s+/, '');
      content = before && after ? `${before}\n\n${after}` : before || after;
    }
    if (content === original) {
      continue;
    }
    if (content.trim() === '') {
      tree.delete(path);
    } else {
      tree.write(path, `${content.replace(/\s+$/, '')}\n`);
    }
    changed.push(path);
  }

  // Older versions pointed Gemini at AGENTS.md for the guidelines; once that
  // file is gone the setting points nowhere.
  if (
    contextFileName === 'AGENTS.md' &&
    !tree.exists(agentsMdPath(directory))
  ) {
    updateJson(tree, geminiSettings, (json) => {
      delete json.contextFileName;
      return json;
    });
  }

  return changed;
}

export function hasNxRulesBlock(tree: Tree, path: string): boolean {
  return tree.isFile(path) && rulesRegex.test(tree.read(path, 'utf-8'));
}
