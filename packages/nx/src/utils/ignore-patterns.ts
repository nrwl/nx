import { readFileSync } from 'fs-extra';
import ignore from 'ignore';
import { dirname } from 'path';
import { logger } from './logger';
import { joinPathFragments, normalizePath } from './path';
import { workspaceRoot } from './workspace-root';
import * as fg from 'fast-glob';
import { readFile } from 'fs/promises';
import { Tree } from '../generators/tree';

const ALWAYS_IGNORE = ['node_modules', '.git'];

export const locatedIgnoreFiles = new Set<string>();

export interface GetIgnoredGlobsOptions {
  /**
   * Files that should be parsed. Defaults to [.nxignore, .gitignore]
   */
  ignoreFiles?: string[];

  /**
   * Extra paths which should be ignored, but may not be specified in an ignore file.
   * Defaults to [`node_modules`, `.git`].
   */
  knownIgnoredPaths?: string[];
}

function getGlobOptions(
  provided?: GetIgnoredGlobsOptions
): Required<GetIgnoredGlobsOptions> {
  return {
    ignoreFiles: provided?.ignoreFiles ?? ['.nxignore', '.gitignore'],
    knownIgnoredPaths: [
      ...(provided?.knownIgnoredPaths ?? []),
      ...ALWAYS_IGNORE,
    ],
  };
}

/**
 * Crawls workspace file system to determine files which should be ignored when
 * performing glob searches
 *
 * @param options see GetIgnoredGlobsOptions
 * @returns a string[] containing glob patterns that should be ignored
 * relative to workspace root
 */
export async function getIgnoredGlobs(
  options?: GetIgnoredGlobsOptions
): Promise<string[]> {
  return getIgnoredGlobsAndIgnore(options).then((x) => x.patterns);
}

/**
 * Synchronously crawls workspace file system to determine files which should be ignored when
 * performing glob searches
 *
 * @param options see GetIgnoredGlobsOptions
 * @returns a string[] containing glob patterns that should be ignored
 * relative to workspace root
 */
export function getIgnoredGlobsSync(
  options?: GetIgnoredGlobsOptions
): string[] {
  return getIgnoredGlobsAndIgnoreSync(options).patterns;
}

export async function getIgnoredGlobsAndIgnore(
  options?: GetIgnoredGlobsOptions
) {
  const { ignoreFiles, knownIgnoredPaths } = getGlobOptions(options);
  const foundIgnoreFiles = await fg(`**/{${ignoreFiles.join(',')}}`, {
    ignore: knownIgnoredPaths,
    cwd: workspaceRoot,
  });
  for (const ignoreFile of foundIgnoreFiles) {
    const fileContents = await readFile(ignoreFile, { encoding: 'utf-8' });
    knownIgnoredPaths.push(
      ...parseIgnoredGlobsFromFile(fileContents, dirname(ignoreFile))
    );
  }

  const ig = ignore().add(knownIgnoredPaths);
  return {
    patterns: knownIgnoredPaths,
    fileIsIgnored: ig.ignores.bind(ig),
  };
}

export function getIgnoredGlobsAndIgnoreSync(options?: GetIgnoredGlobsOptions) {
  const { ignoreFiles, knownIgnoredPaths } = getGlobOptions(options);
  const foundIgnoreFiles = fg.sync(`**/{${ignoreFiles.join(',')}}`, {
    ignore: knownIgnoredPaths,
    cwd: workspaceRoot,
  });
  for (const ignoreFile of foundIgnoreFiles) {
    const fileContents = readFileSync(ignoreFile, { encoding: 'utf-8' });
    knownIgnoredPaths.push(
      ...parseIgnoredGlobsFromFile(fileContents, dirname(ignoreFile))
    );
  }

  const ig = ignore().add(knownIgnoredPaths);
  return {
    patterns: knownIgnoredPaths,
    fileIsIgnored: ig.ignores.bind(ig),
  };
}

export function getIgnoredGlobsInTree(
  tree: Tree,
  options?: GetIgnoredGlobsOptions
) {
  const { ignoreFiles, knownIgnoredPaths } = getGlobOptions(options);
  const ig = ignore();

  function addGlobPatternsFromChildDirectories(directory) {
    const dirEnts = tree.children(directory, { withFileTypes: true });
    for (const entry of dirEnts) {
      const fullPath = joinPathFragments(directory, entry.name);
      if (entry.isDirectory() && !ALWAYS_IGNORE.includes(entry.name)) {
        addGlobPatternsFromChildDirectories(fullPath);
      } else if (ignoreFiles.includes(entry.name)) {
        const fileContents = tree.read(fullPath).toString();
        const newPatterns = parseIgnoredGlobsFromFile(fileContents, directory);
        ig.add(newPatterns);
        knownIgnoredPaths.push(...newPatterns);
      }
    }
    ig.add(knownIgnoredPaths);
  }

  addGlobPatternsFromChildDirectories('.');

  return {
    patterns: knownIgnoredPaths,
    fileIsIgnored: ig.ignores.bind(ig),
  };
}

/**
 * Parses a .gitignore syntax file.
 * @param file Path to the .gitignore file
 * @param tree A tree to use instead of fs operations
 * @returns string[]: a list of patterns to ignore
 */
function parseIgnoredGlobsFromFile(
  fileContents: string,
  prefix: string
): string[] {
  const patterns: string[] = [];
  const directory = prefix;
  try {
    const lines = fileContents.split('\n');
    for (const line of lines) {
      const l = line.trim();
      if (!l.length || l.startsWith('#')) continue;
      // Prefix is at workspace root, and we want paths that are relative to the workspaceRoot.
      if (directory === workspaceRoot || directory === '.') {
        patterns.push(l);
        // Testing revealed that fast-glob's `ignore` method will **not** ignore glob patterns that
        // are a directory layer deep, even if the pattern doesn't start with a `/`. To mimic this
        // functionality, we need to add a globstar pattern.
        if (!l.startsWith('/')) {
          if (l.startsWith('!')) {
            patterns.push('!' + joinPathFragments('**', l.substring(1)));
          } else {
            patterns.push(joinPathFragments('**', l));
          }
        }
      } else {
        // Exclamation points must be moved to the front of a pattern.
        const [prefix, suffix] = l.startsWith('!')
          ? ['!', l.substring(1)]
          : ['', l];

        patterns.push(prefix + joinPathFragments(directory, suffix));
        // For nested gitignore files, we need a similar globstar pattern. In this case, we scope it
        // to the directory that contains the ignore file.
        if (!l.startsWith('/')) {
          patterns.push(prefix + joinPathFragments(directory, '**', suffix));
        }
      }
    }
  } catch (e) {
    logger.warn(`NX was unable to parse ignore file: ${directory}`);
  }
  return normalizePatterns(patterns, workspaceRoot);
}

/**
 * Ensure all patterns are relative to workspace root
 */
const regex = new RegExp(`^${normalizePath(workspaceRoot)}/`);
function normalizePatterns(patterns: string[], root) {
  return patterns.map((x) => x.replace(regex, ''));
}
