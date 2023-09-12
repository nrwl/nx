import { Tree } from '../tree';
import { combineGlobPatterns } from '../../utils/globs';
import { workspaceRoot } from '../../utils/workspace-root';
import { globWithWorkspaceContext } from '../../utils/workspace-context';

import minimatch = require('minimatch');

/**
 * Performs a glob search on the files in a workspace. Paths should be unix-style
 * with forward slashes.
 *
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 */
export async function glob(patterns: string[]): Promise<string[]>;

/**
 * Performs a tree-aware glob search on the files in a workspace. Able to find newly
 * created files and hides deleted files before the updates are committed to disk.
 * Paths should be unix-style with forward slashes.
 *
 * @param tree The file system tree
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 */
export async function glob(tree: Tree, patterns: string[]): Promise<string[]>;

export async function glob(
  treeOrPatterns: Tree | string[],
  maybePatterns?: string[]
): Promise<string[]> {
  const { patterns, root } =
    'root' in treeOrPatterns
      ? { patterns: maybePatterns, root: treeOrPatterns.root }
      : { patterns: treeOrPatterns, root: workspaceRoot };

  const matches = new Set(globWithWorkspaceContext(root, patterns));

  if ('root' in treeOrPatterns) {
    const tree = treeOrPatterns;
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
  }

  return Array.from(matches);
}
