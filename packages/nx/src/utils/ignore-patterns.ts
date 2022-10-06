import { Dirent, existsSync, readdirSync } from 'fs';
import { readFileSync } from 'fs-extra';
import { readdir } from 'fs/promises';
import ignore, { Ignore } from 'ignore';
import { join, relative } from 'path';
import { Tree, VirtualDirEnt } from '../generators/tree';
import { logger } from './logger';
import { normalizePath } from './path';
import { workspaceRoot } from './workspace-root';

const ALWAYS_IGNORE = ['node_modules', '.git'];

export const locatedIgnoreFiles = new Set<string>();

export interface GetIgnoredGlobsOptions {
  ignoreFiles?: string[];
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
  const ig = ignore();
  const { ignoreFiles, knownIgnoredPaths } = getGlobOptions(options);
  const patterns = [
    ...knownIgnoredPaths,
    ...(await getIgnoredGlobsFromDirectory(
      ignoreFiles,
      ig.add(knownIgnoredPaths)
    )),
  ];
  return { patterns, fileIsIgnored: ig.ignores.bind(ig) };
}

export function getIgnoredGlobsAndIgnoreSync(options?: GetIgnoredGlobsOptions) {
  const ig = ignore();
  const { ignoreFiles, knownIgnoredPaths } = getGlobOptions(options);
  return {
    patterns: [
      ...knownIgnoredPaths,
      ...getIgnoredGlobsFromDirectorySync(
        ignoreFiles,
        ig.add(knownIgnoredPaths)
      ),
    ],
    fileIsIgnored: ig.ignores.bind(ig),
  };
}

export function getIgnoredGlobsInTree(
  tree: Tree,
  options?: GetIgnoredGlobsOptions
) {
  const ig = ignore();
  const { ignoreFiles, knownIgnoredPaths } = getGlobOptions(options);
  return {
    patterns: [
      ...knownIgnoredPaths,
      ...getIgnoredGlobsFromDirectorySync(
        ignoreFiles,
        ig.add(knownIgnoredPaths),
        '.',
        tree
      ),
    ],
    fileIsIgnored: ig.ignores.bind(ig),
  };
}

async function getIgnoredGlobsFromDirectory(
  ignoreFiles: string[],
  ignore: Ignore,
  directory = workspaceRoot
): Promise<string[]> {
  const patterns = getPatternsFromDirectory(directory, ignoreFiles);
  ignore.add(patterns);
  const promises: Promise<string[]>[] = await visitChildDirectories(
    directory,
    ignore,
    (p) => getIgnoredGlobsFromDirectory(ignoreFiles, ignore, p)
  );

  patterns.push(...(await Promise.all(promises)).flat());
  return patterns;
}

function getIgnoredGlobsFromDirectorySync(
  ignoreFiles: string[],
  ig = ignore(),
  directory = workspaceRoot,
  tree?: Tree
) {
  const patterns = getPatternsFromDirectory(directory, ignoreFiles, tree);
  ig.add(patterns);
  const childPatterns: string[] = visitChildDirectoriesSync(
    directory,
    ig,
    (childDirectory) =>
      getIgnoredGlobsFromDirectorySync(ignoreFiles, ig, childDirectory, tree),
    tree
  ).flat();

  patterns.push(...childPatterns);
  return patterns;
}

function getPatternsFromDirectory(
  directory: string,
  ignoreFiles: string[],
  tree?: Tree
) {
  try {
    let patterns: string[] = [];
    const validIgnoreFiles = ignoreFiles.map((x) => join(directory, x));
    for (const ignoreFile of validIgnoreFiles) {
      if (tree ? tree.exists(ignoreFile) : existsSync(ignoreFile)) {
        if (!tree) {
          locatedIgnoreFiles.add(
            normalizePath(relative(workspaceRoot, ignoreFile))
          );
        }
        patterns = patterns.concat(
          getIgnoredGlobsFromFile(ignoreFile, directory, tree)
        );
      }
    }
    return patterns;
  } catch (e) {
    console.warn(e);
  }
  return [];
}

async function visitChildDirectories<T>(
  directory: string,
  ignore: Ignore,
  visitor: (p: string) => T
): Promise<T[]> {
  const directoryEntries = await readdir(directory, {
    withFileTypes: true,
  }).catch(() => []);
  return visitChildDirectoriesFromDirEnts(
    directory,
    directoryEntries,
    ignore,
    visitor
  );
}

function visitChildDirectoriesSync<T>(
  directory: string,
  ignore: Ignore,
  visitor: (p: string) => T,
  tree?: Tree
): T[] {
  try {
    const directoryEntries: (Dirent | VirtualDirEnt)[] = tree
      ? tree.children(directory, { withFileTypes: true })
      : readdirSync(directory, { withFileTypes: true });

    return visitChildDirectoriesFromDirEnts(
      directory,
      directoryEntries,
      ignore,
      visitor
    );
  } catch {
    return [];
  }
}

function visitChildDirectoriesFromDirEnts<T>(
  directory: string,
  directoryEntries: (Dirent | VirtualDirEnt)[],
  ignore: Ignore,
  visitor: (p: string) => T,
  tree?: Tree
): T[] {
  const returnValues: T[] = [];
  for (const directoryEntry of directoryEntries) {
    const filePath = join(directory, directoryEntry.name);
    if (
      directoryEntry.isDirectory() &&
      !ignore.ignores(tree ? filePath : relative(workspaceRoot, filePath))
    ) {
      returnValues.push(visitor(filePath));
    }
  }
  return returnValues;
}

function getIgnoredGlobsFromFile(
  file: string,
  prefix: string,
  tree?: Tree
): string[] {
  const patterns = [];
  try {
    const lines = (
      tree ? tree.read(file, 'utf-8') : readFileSync(file, 'utf-8')
    ).split('\n');
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith('#')) continue;
      if (prefix === workspaceRoot || (tree && prefix === '.')) {
        patterns.push(l);
      } else {
        patterns.push(join(prefix, l));
        if (!l.startsWith('/')) {
          patterns.push(join(prefix, '**', l));
        }
      }
    }
  } catch (e) {
    logger.warn(`NX was unable to parse ignore file: ${file}`);
  }
  return patterns;
}
