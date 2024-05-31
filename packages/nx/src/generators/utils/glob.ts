import { minimatch } from 'minimatch';
import { Tree } from '../tree';
import { combineGlobPatterns } from '../../utils/globs';
import {
  globWithWorkspaceContext,
  globWithWorkspaceContextSync,
} from '../../utils/workspace-context';

/**
 * Performs a tree-aware glob search on the files in a workspace. Able to find newly
 * created files and hides deleted files before the updates are committed to disk.
 * Paths should be unix-style with forward slashes.
 *
 * @param tree The file system tree
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 * @deprecated Use {@link globAsync} instead.
 */
export function glob(tree: Tree, patterns: string[]): string[] {
  return combineGlobResultsWithTree(
    tree,
    patterns,
    globWithWorkspaceContextSync(tree.root, patterns)
  );
}

/**
 * Performs a tree-aware glob search on the files in a workspace. Able to find newly
 * created files and hides deleted files before the updates are committed to disk.
 * Paths should be unix-style with forward slashes.
 *
 * @param tree The file system tree
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 */
export async function globAsync(
  tree: Tree,
  patterns: string[]
): Promise<string[]> {
  return combineGlobResultsWithTree(
    tree,
    patterns,
    await globWithWorkspaceContext(tree.root, patterns)
  );
}

function combineGlobResultsWithTree(
  tree: Tree,
  patterns: string[],
  results: string[]
) {
  const matches = new Set(results);

  const combinedGlob = combineGlobPatterns(patterns);
  const matcher = minimatch.makeRe(combinedGlob);

  if (!matcher) {
    throw new Error('Invalid glob pattern: ' + combinedGlob);
  }

  for (const change of tree.listChanges()) {
    if (change.type !== 'UPDATE' && matcher.test(change.path)) {
      if (change.type === 'CREATE') {
        matches.add(change.path);
      } else if (change.type === 'DELETE') {
        matches.delete(change.path);
      }
    }
  }

  return Array.from(matches);
}
