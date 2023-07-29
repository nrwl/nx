import { readFileSync } from 'fs-extra';
import ignore from 'ignore';
import { readFileIfExisting } from './fileutils';
import { joinPathFragments } from './path';
import { workspaceRoot } from './workspace-root';

/**
 * An array of glob patterns that should always be ignored.
 * Uses path/posix, since fast-glob requires unix paths.
 */
export const ALWAYS_IGNORE = getAlwaysIgnore();

export function getIgnoredGlobs(
  root: string = workspaceRoot,
  prependRoot: boolean = true
) {
  const files = ['.gitignore', '.nxignore'];
  if (prependRoot) {
    return [
      ...getAlwaysIgnore(root),
      ...files.flatMap((f) =>
        getIgnoredGlobsFromFile(joinPathFragments(root, f), root)
      ),
    ];
  } else {
    return [
      ...getAlwaysIgnore(),
      ...files.flatMap((f) =>
        getIgnoredGlobsFromFile(joinPathFragments(root, f))
      ),
    ];
  }
}

export function getAlwaysIgnore(root?: string) {
  const paths = ['node_modules', '**/node_modules', '.git'];
  return root ? paths.map((x) => joinPathFragments(root, x)) : paths;
}

export function getIgnoreObject(
  root: string = workspaceRoot
): ReturnType<typeof ignore> {
  const ig = ignore();
  ig.add(readFileIfExisting(`${root}/.gitignore`));
  ig.add(readFileIfExisting(`${root}/.nxignore`));
  return ig;
}

function getIgnoredGlobsFromFile(file: string, root?: string): string[] {
  try {
    const results = [];
    const contents = readFileSync(file, 'utf-8');
    const lines = contents.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      } else if (trimmed.startsWith('/')) {
        if (root) {
          results.push(joinPathFragments(root, trimmed));
        } else {
          results.push(joinPathFragments('.', trimmed));
        }
      } else {
        results.push(trimmed);
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}
