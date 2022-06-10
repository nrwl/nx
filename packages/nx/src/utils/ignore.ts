import * as fastGlob from 'fast-glob';
import * as fs from 'fs';
import ignore, { Ignore } from 'ignore';
import * as path from 'path';
import { Tree } from '../generators/tree';
import { normalizePath } from './path';
import { workspaceRoot } from './workspace-root';

const workspaceIgnoreFiles = ['.gitignore', '.nxignore'];

export function createNxIgnore(root: string = workspaceRoot): Ignore {
  return createIgnore(root, ['.nxignore']);
}

export function createGitIgnoreFromTree(tree: Tree): Ignore {
  return createIgnoreFromTree(tree, ['.gitignore']);
}

export function readWorkspaceIgnorePatterns(root = workspaceRoot): string[] {
  return combineIgnorePatterns(
    workspaceIgnoreFiles.flatMap((ignoreFile) =>
      readIgnoreFiles(root, ignoreFile)
    )
  );
}

export function createIgnoreFromPatterns(patterns: string[]): Ignore {
  const ig = ignore();
  ig.add(patterns);
  return ig;
}

/**
 * Reads ignore files from the file system and returns an object which can be
 * used to check whether a file should be ignored.
 *
 * @param rootDir The directory in which to start searching for ignore files.
 *                Paths evaluated by the returned object must be relative to this directory.
 *                Defaults to the workspace root.
 * @param ignoreFiles The filename of ignore files to include, e.g. ".gitignore".
 *                    Defaults to [".gitignore", ".nxignore"].
 */
export function createIgnore(
  rootDir = workspaceRoot,
  ignoreFiles = workspaceIgnoreFiles
): Ignore {
  return createCombinedIgnore(
    ignoreFiles.flatMap((ignoreFile) => readIgnoreFiles(rootDir, ignoreFile))
  );
}

/**
 * Reads ignore files from a Tree and returns an object which can be
 * used to check whether a file should be ignored.
 *
 * @param tree The tree in which to searching for ignore files.
 *             Paths evaluated by the returned object must be relative to the tree root.
 * @param ignoreFiles The filename of ignore files to include, e.g. ".gitignore".
 *                    Defaults to [".gitignore", ".nxignore"].
 */
export function createIgnoreFromTree(
  tree: Tree,
  ignoreFiles = workspaceIgnoreFiles
): Ignore {
  return createCombinedIgnore(
    ignoreFiles.flatMap((ignoreFile) =>
      readIgnoreFilesFromTree(tree, ignoreFile)
    )
  );
}

interface IgnoreFile {
  /**
   * Path to the ignore file, relative to the root directory.
   */
  path: string;
  /**
   * Content of the ignore file.
   */
  content: string;
}

function readIgnoreFiles(rootDir: string, ignoreFile: string): IgnoreFile[] {
  const ignoreFilePaths = fastGlob.sync(`**/${ignoreFile}`, {
    cwd: rootDir,
    dot: true,
  });

  return ignoreFilePaths.map((filePath) => ({
    path: filePath,
    content: fs.readFileSync(path.join(rootDir, filePath), 'utf-8'),
  }));
}

function readIgnoreFilesFromTree(tree: Tree, ignoreFile: string): IgnoreFile[] {
  const remainingPaths = ['.'];
  const ignoreFiles: IgnoreFile[] = [];

  while (remainingPaths.length > 0) {
    const currentPath = remainingPaths.pop();

    for (const child of tree.children(currentPath)) {
      const childPath = normalizePath(path.join(currentPath, child));
      if (tree.isFile(childPath)) {
        if (child === ignoreFile) {
          ignoreFiles.push({
            path: childPath,
            content: tree.read(childPath, 'utf-8'),
          });
        }
      } else {
        remainingPaths.push(childPath);
      }
    }
  }

  return ignoreFiles;
}

export function createCombinedIgnore(ignoreFiles: IgnoreFile[]): Ignore {
  return createIgnoreFromPatterns(combineIgnorePatterns(ignoreFiles));
}

function combineIgnorePatterns(ignoreFiles: IgnoreFile[]): string[] {
  return ignoreFiles.flatMap(parseIgnoreFile);
}

function parseIgnoreFile(file: IgnoreFile): string[] {
  const base = normalizePath(path.dirname(file.path));
  const patterns = file.content
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'));

  if (base === '.') {
    return patterns;
  }

  return patterns.map((pattern) => applyBaseToPattern(pattern, base));
}

function applyBaseToPattern(pattern: string, base: string): string {
  return isNegativePattern(pattern)
    ? '!' + path.posix.join(base, pattern.slice(1))
    : path.posix.join(base, pattern);
}

function isNegativePattern(pattern: string): boolean {
  return pattern[0] === '!';
}
