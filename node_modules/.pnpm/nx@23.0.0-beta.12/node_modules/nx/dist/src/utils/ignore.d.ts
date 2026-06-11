import ignore = require('ignore');
import { Tree } from '../generators/tree';
export declare function getIgnoreObject(root?: string): ReturnType<typeof ignore>;
export declare function getIgnoreObjectForTree(tree: Tree): ignore.Ignore;
/**
 * Adds an entry to a .gitignore file if it's not already covered by existing patterns.
 * Creates the file if it doesn't exist.
 */
export declare function addEntryToGitIgnore(tree: Tree, gitignorePath: string, entry: string): void;
