import { Tree } from '../tree';
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
export declare function glob(tree: Tree, patterns: string[]): string[];
/**
 * Performs a tree-aware glob search on the files in a workspace. Able to find newly
 * created files and hides deleted files before the updates are committed to disk.
 * Paths should be unix-style with forward slashes.
 *
 * @param tree The file system tree
 * @param patterns A list of glob patterns
 * @returns Normalized paths in the workspace that match the provided glob patterns.
 */
export declare function globAsync(tree: Tree, patterns: string[]): Promise<string[]>;
