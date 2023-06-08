import { execSync } from 'child_process';
import * as path from 'path';
import {
  getProjectRoots,
  NxArgs,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { fileExists, readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { calculateFileChanges, FileData } from '../../project-graph/file-utils';
import * as yargs from 'yargs';

import * as prettier from 'prettier';
import { sortObjectByKeys } from '../../utils/object-sort';
import {
  getRootTsConfigFileName,
  getRootTsConfigPath,
} from '../../plugins/js/utils/typescript';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { readNxJson } from '../../config/configuration';
import { ProjectGraph } from '../../config/project-graph';
import { chunkify } from '../../utils/chunkify';
import { allFileData } from '../../utils/all-file-data';

const PRETTIER_PATH = require.resolve('prettier/bin-prettier');

export async function format(
  command: 'check' | 'write',
  args: yargs.Arguments
): Promise<void> {
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    { printWarnings: false },
    readNxJson()
  );
  const patterns = (await getPatterns({ ...args, ...nxArgs } as any)).map(
    // prettier removes one of the \
    // prettier-ignore
    (p) => `"${p.replace(/\$/g, "\\\$")}"`
  );

  // Chunkify the patterns array to prevent crashing the windows terminal
  const chunkList: string[][] = chunkify(patterns);

  switch (command) {
    case 'write':
      sortTsConfig();
      addRootConfigFiles(chunkList, nxArgs);
      chunkList.forEach((chunk) => write(chunk));
      break;
    case 'check':
      const pass = chunkList.reduce(
        (pass, chunk) => check(chunk) && pass,
        true
      );
      if (!pass) {
        process.exit(1);
      }
      break;
  }
}

async function getPatterns(
  args: NxArgs & { libsAndApps: boolean; _: string[] }
): Promise<string[]> {
  const graph = await createProjectGraphAsync({ exitOnError: true });
  const allFilesPattern = ['.'];

  if (args.all) {
    return allFilesPattern;
  }

  try {
    if (args.projects && args.projects.length > 0) {
      return getPatternsFromProjects(args.projects, graph);
    }

    const p = parseFiles(args);

    const supportedExtensions = prettier
      .getSupportInfo()
      .languages.flatMap((language) => language.extensions)
      .filter((extension) => !!extension)
      // Prettier supports ".swcrc" as a file instead of an extension
      // So we add ".swcrc" as a supported extension manually
      // which allows it to be considered for calculating "patterns"
      .concat('.swcrc');

    const patterns = p.files.filter(
      (f) => fileExists(f) && supportedExtensions.includes(path.extname(f))
    );

    return args.libsAndApps
      ? await getPatternsFromApps(patterns, await allFileData(), graph)
      : patterns;
  } catch {
    return allFilesPattern;
  }
}

async function getPatternsFromApps(
  affectedFiles: string[],
  allWorkspaceFiles: FileData[],
  projectGraph: ProjectGraph
): Promise<string[]> {
  const graph = await createProjectGraphAsync({ exitOnError: true });
  const affectedGraph = await filterAffected(
    graph,
    calculateFileChanges(affectedFiles, allWorkspaceFiles)
  );
  return getPatternsFromProjects(
    Object.keys(affectedGraph.nodes),
    projectGraph
  );
}

function addRootConfigFiles(chunkList: string[][], nxArgs: NxArgs): void {
  if (nxArgs.all) {
    return;
  }
  const chunk = [];
  const addToChunkIfNeeded = (file: string) => {
    if (chunkList.every((c) => !c.includes(`"${file}"`))) {
      chunk.push(file);
    }
  };
  // if (workspaceJsonPath) {
  //   addToChunkIfNeeded(workspaceJsonPath);
  // }
  ['nx.json', getRootTsConfigFileName()]
    .filter(Boolean)
    .forEach(addToChunkIfNeeded);

  if (chunk.length > 0) {
    chunkList.push(chunk);
  }
}

function getPatternsFromProjects(
  projects: string[],
  projectGraph: ProjectGraph
): string[] {
  return getProjectRoots(projects, projectGraph);
}

function write(patterns: string[]) {
  if (patterns.length > 0) {
    const [swcrcPatterns, regularPatterns] = patterns.reduce(
      (result, pattern) => {
        result[pattern.includes('.swcrc') ? 0 : 1].push(pattern);
        return result;
      },
      [[], []] as [swcrcPatterns: string[], regularPatterns: string[]]
    );

    execSync(
      `node "${PRETTIER_PATH}" --write --list-different ${regularPatterns.join(
        ' '
      )}`,
      {
        stdio: [0, 1, 2],
      }
    );

    if (swcrcPatterns.length > 0) {
      execSync(
        `node "${PRETTIER_PATH}" --write --list-different ${swcrcPatterns.join(
          ' '
        )} --parser json`,
        {
          stdio: [0, 1, 2],
        }
      );
    }
  }
}

function check(patterns: string[]): boolean {
  if (patterns.length === 0) {
    return true;
  }
  try {
    execSync(`node "${PRETTIER_PATH}" --list-different ${patterns.join(' ')}`, {
      stdio: [0, 1, 2],
    });
    return true;
  } catch {
    return false;
  }
}

function sortTsConfig() {
  try {
    const tsconfigPath = getRootTsConfigPath();
    const tsconfig = readJsonFile(tsconfigPath);
    const sortedPaths = sortObjectByKeys(tsconfig.compilerOptions.paths);
    tsconfig.compilerOptions.paths = sortedPaths;
    writeJsonFile(tsconfigPath, tsconfig);
  } catch (e) {
    // catch noop
  }
}
