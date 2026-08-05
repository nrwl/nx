import picomatch from 'picomatch';
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

  let matcher: (path: string) => boolean;
  try {
    if (!patterns.length) {
      throw new Error('no patterns');
    }
    // mixing negations into one picomatch call would let any path match via
    // "not excluded"; require a positive match, then reject negated ones
    const positive = patterns.filter((p) => !p.startsWith('!'));
    const negated = patterns
      .filter((p) => p.startsWith('!'))
      .map((p) => p.substring(1));
    const isPositive = picomatch(positive);
    const isNegated = negated.length ? picomatch(negated) : () => false;
    matcher = (path) => isPositive(path) && !isNegated(path);
  } catch {
    // picomatch throws on empty patterns where minimatch.makeRe returned false
    throw new Error('Invalid glob pattern: ' + combineGlobPatterns(patterns));
  }

  for (const change of tree.listChanges()) {
    if (change.type !== 'UPDATE' && matcher(change.path)) {
      if (change.type === 'CREATE') {
        matches.add(change.path);
      } else if (change.type === 'DELETE') {
        matches.delete(change.path);
      }
    }
  }

  return Array.from(matches);
}
