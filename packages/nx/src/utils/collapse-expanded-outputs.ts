import { dirname } from 'path';

/**
 * Heuristic to prevent writing too many hash files
 */
const MAX_OUTPUTS_TO_CHECK_HASHES = 3;

export function collapseExpandedOutputs(expandedOutputs: string[]) {
  const tree: Set<string>[] = [];

  // Create a Tree of directories/files
  for (const output of expandedOutputs) {
    const pathParts = [];
    pathParts.unshift(output);
    let dir = dirname(output);
    while (dir !== dirname(dir)) {
      pathParts.unshift(dir);

      dir = dirname(dir);
    }

    for (let i = 0; i < pathParts.length; i++) {
      tree[i] ??= new Set<string>();
      tree[i].add(pathParts[i]);
    }
  }

  // Find a level in the tree that has too many outputs
  if (tree.length === 0) {
    return [];
  }

  let j = 0;
  let level = tree[j];
  for (j = 0; j < tree.length; j++) {
    level = tree[j];
    if (level.size > MAX_OUTPUTS_TO_CHECK_HASHES) {
      break;
    }
  }

  // Return the level before the level with too many outputs
  // If the first level has too many outputs, return that one.
  return Array.from(tree[Math.max(0, j - 1)]);
}
