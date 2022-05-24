import * as fastGlob from 'fast-glob';
import * as fs from 'fs';
import ignore, { Ignore } from 'ignore';
import * as path from 'path';
import { Tree } from '../generators/tree';
import { workspaceRoot } from './workspace-root';
import { normalizePath } from './path';

const workspaceIgnoreFiles = ['.gitignore', '.nxignore'];

export function createWorkspaceIgnore(root = workspaceRoot): Ignore {
  return createIgnoreFromFS(root, workspaceIgnoreFiles);
}

export function createNxignore(root: string = workspaceRoot): Ignore {
  return createIgnoreFromFS(root, ['.nxignore']);
}

export function createGitignoreFromTree(tree: Tree): Ignore {
  return createIgnoreFromTree(tree, ['.gitignore']);
}

export function readWorkspaceIgnorePatterns(root = workspaceRoot): string[] {
  return combineIgnorePatterns(
    workspaceIgnoreFiles.flatMap((ignoreFile) =>
      readIgnoreFilesFromFS(root, ignoreFile)
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
 * @param ignoreFiles The filename of ignore files to include, e.g. ".gitignore"
 */
export function createIgnoreFromFS(
  rootDir: string,
  ignoreFiles: string[]
): Ignore {
  return createCombinedIgnore(
    ignoreFiles.flatMap((ignoreFile) =>
      readIgnoreFilesFromFS(rootDir, ignoreFile)
    )
  );
}

/**
 * Reads ignore files from a Tree and returns an object which can be
 * used to check whether a file should be ignored.
 *
 * @param tree The tree in which to searching for ignore files.
 *             Paths evaluated by the returned object must be relative to the tree root.
 * @param ignoreFiles The filename of ignore files to include, e.g. ".gitignore"
 */
export function createIgnoreFromTree(
  tree: Tree,
  ignoreFiles: string[]
): Ignore {
  return createCombinedIgnore(
    ignoreFiles.flatMap((ignoreFile) =>
      readIgnoreFilesFromTree(tree, ignoreFile)
    )
  );
}

export interface IgnoreFile {
  /**
   * Path to the ignore file, relative to the root directory.
   */
  path: string;
  /**
   * Content of the ignore file.
   */
  content: string;
}

function readIgnoreFilesFromFS(
  rootDir: string,
  ignoreFile: string
): IgnoreFile[] {
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

  return file.content
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((pattern) => applyBaseToPattern(pattern, base));
}

function applyBaseToPattern(pattern: string, base: string): string {
  return isNegativePattern(pattern)
    ? '!' + path.posix.join(base, pattern.slice(1))
    : path.posix.join(base, pattern);
}

function isNegativePattern(pattern: string): boolean {
  return pattern[0] === '!';
}
