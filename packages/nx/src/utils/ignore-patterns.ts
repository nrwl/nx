import { Dirent, existsSync, readdirSync } from 'fs';
import { readFileSync } from 'fs-extra';
import { readdir } from 'fs/promises';
import ignore, { Ignore } from 'ignore';
import { join, relative } from 'path';
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
  directory = workspaceRoot
) {
  const patterns = getPatternsFromDirectory(directory, ignoreFiles);
  ig.add(patterns);
  const childPatterns: string[] = visitChildDirectoriesSync(
    directory,
    ig,
    (p) => getIgnoredGlobsFromDirectorySync(ignoreFiles, ig, p)
  ).flat();

  patterns.push(...childPatterns);
  return patterns;
}

function getPatternsFromDirectory(directory: string, ignoreFiles: string[]) {
  try {
    let patterns: string[] = [];
    const validIgnoreFiles = ignoreFiles.map((x) => join(directory, x));
    for (const ignoreFile of validIgnoreFiles) {
      if (existsSync(ignoreFile)) {
        locatedIgnoreFiles.add(
          normalizePath(relative(workspaceRoot, ignoreFile))
        );
        patterns = patterns.concat(
          getIgnoredGlobsFromFile(ignoreFile, directory)
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
  visitor: (p: string) => T
): T[] {
  try {
    const directoryEntries = readdirSync(directory, { withFileTypes: true });
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
  directoryEntries: Dirent[],
  ignore: Ignore,
  visitor: (p: string) => T
): T[] {
  const returnValues: T[] = [];
  for (const directoryEntry of directoryEntries) {
    const filePath = join(directory, directoryEntry.name);
    if (
      directoryEntry.isDirectory() &&
      !ignore.ignores(relative(workspaceRoot, filePath))
    ) {
      returnValues.push(visitor(filePath));
    }
  }
  return returnValues;
}

function getIgnoredGlobsFromFile(file: string, prefix: string): string[] {
  try {
    return readFileSync(file, 'utf-8')
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => !!i && !i.startsWith('#'))
      .map((i) => {
        // Path should be underneath current root
        if (prefix !== workspaceRoot) {
          if (i.startsWith('/')) {
            return join(prefix, i);
          }

          return join(prefix, '**', i);
          // Path should be left as is
        } else {
          return i;
        }
      });
  } catch (e) {
    logger.warn(`NX was unable to parse ignore file: ${file}`);
    return [];
  }
}
