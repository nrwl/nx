import { posix } from 'node:path';
import { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';

const markerStart = '<!-- nx configuration start-->';
const markerEnd = '<!-- nx configuration end-->';
const markerDescription =
  '<!-- Leave the start & end comments to automatically receive updates. -->';
const nxBlockRegex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);

/**
 * Removes the Nx guidelines block older versions of `nx configure-ai-agents`
 * wrote into AGENTS.md, CLAUDE.md, GEMINI.md and the files Gemini's
 * `contextFileName` names. A file left empty is deleted.
 */
export function removeNxRulesBlocks(tree: Tree, directory: string): void {
  const agentsMd = posix.join(directory, 'AGENTS.md');
  // AGENTS.md goes first: whether it survives decides what happens to a
  // block in another file that only imports it.
  for (const path of [agentsMd, ...otherRulesFiles(tree, directory)]) {
    if (!tree.isFile(path)) {
      continue;
    }
    const original = tree.read(path, 'utf-8');
    const updated = removeNxBlocks(original, tree.isFile(agentsMd));
    if (updated === original) {
      continue;
    }
    if (updated === '') {
      tree.delete(path);
    } else {
      tree.write(path, updated);
    }
  }
}

function otherRulesFiles(tree: Tree, directory: string): string[] {
  const paths = new Set(['CLAUDE.md', 'GEMINI.md']);
  for (const fileName of geminiContextFileNames(tree, directory)) {
    const path = posix.normalize(fileName);
    if (!posix.isAbsolute(path) && !path.startsWith('..')) {
      paths.add(path);
    }
  }
  paths.delete('AGENTS.md');
  return [...paths].map((path) => posix.join(directory, path));
}

function geminiContextFileNames(tree: Tree, directory: string): string[] {
  const settingsPath = posix.join(directory, '.gemini', 'settings.json');
  if (!tree.isFile(settingsPath)) {
    return [];
  }
  let contextFileName: unknown;
  try {
    contextFileName = readJson(tree, settingsPath)?.contextFileName;
  } catch {
    return [];
  }
  return [contextFileName]
    .flat()
    .filter((name): name is string => typeof name === 'string' && name !== '');
}

function removeNxBlocks(content: string, agentsMdExists: boolean): string {
  let match: RegExpExecArray | null;
  while ((match = nxBlockRegex.exec(content))) {
    const before = content.slice(0, match.index).trimEnd();
    const after = content.slice(match.index + match[0].length).trim();
    // A block that only imports AGENTS.md is how the file's reader gets the
    // user's own AGENTS.md content, so the import outlives the markers.
    const kept =
      agentsMdExists && blockBody(match[0]) === '@AGENTS.md'
        ? '@AGENTS.md'
        : '';
    const parts = [before, kept, after].filter((part) => part !== '');
    content = parts.length > 0 ? `${parts.join('\n\n')}\n` : '';
  }
  return content;
}

function blockBody(block: string): string {
  return block
    .replace(markerStart, '')
    .replace(markerEnd, '')
    .replace(markerDescription, '')
    .trim();
}
