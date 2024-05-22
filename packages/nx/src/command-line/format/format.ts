import { exec, execSync } from 'node:child_process';
import * as path from 'node:path';
import * as yargs from 'yargs';
import { FileData, calculateFileChanges } from '../../project-graph/file-utils';
import {
  NxArgs,
  getProjectRoots,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { fileExists, readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { getIgnoreObject } from '../../utils/ignore';

import type { SupportInfo } from 'prettier';
import * as prettier from 'prettier';
import { readNxJson } from '../../config/configuration';
import { ProjectGraph } from '../../config/project-graph';
import {
  getRootTsConfigFileName,
  getRootTsConfigPath,
} from '../../plugins/js/utils/typescript';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { allFileData } from '../../utils/all-file-data';
import { chunkify } from '../../utils/chunkify';
import { sortObjectByKeys } from '../../utils/object-sort';
import { output } from '../../utils/output';
import { readModulePackageJson } from '../../utils/package-json';
import { workspaceRoot } from '../../utils/workspace-root';

const PRETTIER_PATH = getPrettierPath();

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
    case 'check': {
      const filesWithDifferentFormatting = [];
      for (const chunk of chunkList) {
        const files = await check(chunk);
        filesWithDifferentFormatting.push(...files);
      }
      if (filesWithDifferentFormatting.length > 0) {
        if (nxArgs.verbose) {
          output.error({
            title:
              'The following files are not formatted correctly based on your Prettier configuration',
            bodyLines: [
              '- Run "nx format:write" and commit the resulting diff to fix these files.',
              '- Please note, Prettier does not support a native way to diff the output of its check logic (https://github.com/prettier/prettier/issues/6885).',
              '',
              ...filesWithDifferentFormatting,
            ],
          });
        } else {
          console.log(filesWithDifferentFormatting.join('\n'));
        }
        process.exit(1);
      }
      break;
    }
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

    // In prettier v3 the getSupportInfo result is a promise
    const supportedExtensions = new Set(
      (
        await (prettier.getSupportInfo() as Promise<SupportInfo> | SupportInfo)
      ).languages
        .flatMap((language) => language.extensions)
        .filter((extension) => !!extension)
        // Prettier supports ".swcrc" as a file instead of an extension
        // So we add ".swcrc" as a supported extension manually
        // which allows it to be considered for calculating "patterns"
        .concat('.swcrc')
    );

    const patterns = p.files
      .map((f) => path.relative(workspaceRoot, f))
      .filter((f) => fileExists(f) && supportedExtensions.has(path.extname(f)));

    // exclude patterns in .nxignore or .gitignore
    const nonIgnoredPatterns = getIgnoreObject().filter(patterns);

    return args.libsAndApps
      ? await getPatternsFromApps(
          nonIgnoredPatterns,
          await allFileData(),
          graph
        )
      : nonIgnoredPatterns;
  } catch (err) {
    output.error({
      title:
        err?.message ||
        'Something went wrong when resolving the list of files for the formatter',
      bodyLines: [`Defaulting to all files pattern: "${allFilesPattern}"`],
    });
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

async function check(patterns: string[]): Promise<string[]> {
  if (patterns.length === 0) {
    return [];
  }
  return new Promise((resolve) => {
    exec(
      `node "${PRETTIER_PATH}" --list-different ${patterns.join(' ')}`,
      { encoding: 'utf-8' },
      (error, stdout) => {
        if (error) {
          // The command failed so there are files with different formatting. Prettier writes them to stdout, newline separated.
          resolve(stdout.trim().split('\n'));
        } else {
          // The command succeeded so there are no files with different formatting
          resolve([]);
        }
      }
    );
  });
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

function getPrettierPath() {
  const { bin } = readModulePackageJson('prettier').packageJson;
  return require.resolve(path.join('prettier', bin as string));
}
