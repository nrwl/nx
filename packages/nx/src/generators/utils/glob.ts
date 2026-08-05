import picomatch from 'picomatch';
import { Tree } from '../tree';
import { combineGlobPatterns, splitGlobPatterns } from '../../utils/globs';
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
  const invalid = patterns.find((p) => !p);
  if (!patterns.length || invalid !== undefined) {
    // picomatch throws on an empty pattern where minimatch.makeRe returned false
    throw new Error(
      'Invalid glob pattern: ' +
        JSON.stringify(invalid ?? combineGlobPatterns(patterns))
    );
  }
  // Mirror NxGlobSet::is_match in src/native/glob.rs, which produced `results`:
  // a positive glob must match and no negation may, and a list of only
  // negations matches everything it does not exclude. Folding the negations
  // into one picomatch call instead would let any path match via "not
  // excluded". `!(` opens an extglob, not a negation.
  const isNegation = (p: string) => p.startsWith('!') && !p.startsWith('!(');
  const positive = patterns
    .filter((p) => !isNegation(p))
    .flatMap(splitGlobPatterns);
  const negators = patterns.filter(isNegation).map((p) => picomatch(p));
  const isPositive =
    negators.length && !positive.length ? () => true : picomatch(positive);
  matcher = (path) => isPositive(path) && negators.every((m) => m(path));

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
