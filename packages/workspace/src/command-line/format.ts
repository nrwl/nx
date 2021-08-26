import { execSync } from 'child_process';
import * as path from 'path';
import { getProjectRoots, parseFiles } from './shared';
import { fileExists } from '../utilities/fileutils';
import {
  createProjectGraphAsync,
  onlyWorkspaceProjects,
} from '../core/project-graph';
import { filterAffected } from '../core/affected-project-graph';
import { calculateFileChanges } from '../core/file-utils';
import * as yargs from 'yargs';
import { NxArgs, splitArgsIntoNxArgsAndOverrides } from './utils';
import {
  reformattedWorkspaceJsonOrNull,
  workspaceConfigName,
  WorkspaceJsonConfiguration,
} from '@nrwl/tao/src/shared/workspace';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import * as prettier from 'prettier';
import { NxJsonConfiguration, readJsonFile, writeJsonFile } from '@nrwl/devkit';
import { sortObjectByKeys } from '@nrwl/tao/src/utils/object-sort';

const PRETTIER_PATH = require.resolve('prettier/bin-prettier');

export async function format(
  command: 'check' | 'write',
  args: yargs.Arguments
): Promise<void> {
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(args, 'affected');
  const workspaceJsonPath = workspaceConfigName(appRootPath);
  const patterns = (await getPatterns({ ...args, ...nxArgs } as any)).map(
    (p) => `"${p}"`
  );

  // Chunkify the patterns array to prevent crashing the windows terminal
  const chunkList: string[][] = chunkify(patterns, 50);

  switch (command) {
    case 'write':
      updateWorkspaceJsonToMatchFormatVersion();
      sortWorkspaceJson();
      sortTsConfig();
      movePropertiesToNewLocations();
      chunkList.push([workspaceJsonPath, 'nx.json', 'tsconfig.base.json']);
      chunkList.forEach((chunk) => write(chunk));
      break;
    case 'check':
      chunkList.forEach((chunk) => check(chunk));
      break;
  }
}

async function getPatterns(
  args: NxArgs & { libsAndApps: boolean; _: string[] }
): Promise<string[]> {
  const supportedExtensions = prettier
    .getSupportInfo()
    .languages.flatMap((language) => language.extensions)
    .filter((extension) => !!extension);
  const matchAllPattern = `**/*{${supportedExtensions.join(',')}}`;
  const allFilesPattern = [matchAllPattern];

  if (args.all) {
    return allFilesPattern;
  }

  try {
    if (args.projects && args.projects.length > 0) {
      return getPatternsFromProjects(args.projects, matchAllPattern);
    }

    const p = parseFiles(args);
    const patterns = p.files.filter(
      (f) => fileExists(f) && supportedExtensions.includes(path.extname(f))
    );

    return args.libsAndApps
      ? await getPatternsFromApps(patterns, matchAllPattern)
      : patterns;
  } catch {
    return allFilesPattern;
  }
}

async function getPatternsFromApps(
  affectedFiles: string[],
  matchAllPattern: string
): Promise<string[]> {
  const graph = onlyWorkspaceProjects(await createProjectGraphAsync('4.0'));
  const affectedGraph = filterAffected(
    graph,
    calculateFileChanges(affectedFiles)
  );
  return getPatternsFromProjects(
    Object.keys(affectedGraph.nodes),
    matchAllPattern
  );
}

function getPatternsFromProjects(
  projects: string[],
  matchAllPattern: string
): string[] {
  const roots = getProjectRoots(projects);
  return roots.map((root) => `${root}/${matchAllPattern}`);
}

function chunkify(target: string[], size: number): string[][] {
  return target.reduce((current: string[][], value: string, index: number) => {
    if (index % size === 0) current.push([]);
    current[current.length - 1].push(value);
    return current;
  }, []);
}

function write(patterns: string[]) {
  if (patterns.length > 0) {
    execSync(`node "${PRETTIER_PATH}" --write ${patterns.join(' ')}`, {
      stdio: [0, 1, 2],
    });
  }
}

function check(patterns: string[]) {
  if (patterns.length > 0) {
    try {
      execSync(
        `node "${PRETTIER_PATH}" --list-different ${patterns.join(' ')}`,
        {
          stdio: [0, 1, 2],
        }
      );
    } catch {
      process.exit(1);
    }
  }
}

function updateWorkspaceJsonToMatchFormatVersion() {
  const workspaceConfig = workspaceConfigName(appRootPath);
  try {
    const workspaceJson = readJsonFile(workspaceConfig);
    const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
    if (reformatted) {
      writeJsonFile(workspaceConfig, reformatted);
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}

function sortWorkspaceJson() {
  const workspaceJsonPath = workspaceConfigName(appRootPath);
  try {
    const workspaceJson = readJsonFile(workspaceJsonPath);
    if (Object.entries(workspaceJson.projects).length !== 0) {
      const sortedProjects = sortObjectByKeys(workspaceJson.projects);
      workspaceJson.projects = sortedProjects;
      writeJsonFile(workspaceJsonPath, workspaceJson);
    }
  } catch (e) {
    // catch noop
  }
}

function sortTsConfig() {
  try {
    const tsconfigPath = path.join(appRootPath, 'tsconfig.base.json');
    const tsconfig = readJsonFile(tsconfigPath);
    const sortedPaths = sortObjectByKeys(tsconfig.compilerOptions.paths);
    tsconfig.compilerOptions.paths = sortedPaths;
    writeJsonFile(tsconfigPath, tsconfig);
  } catch (e) {
    // catch noop
  }
}

function movePropertiesToNewLocations() {
  const workspaceConfig = workspaceConfigName(appRootPath);
  try {
    const workspaceJson = readJsonFile<NxJsonConfiguration & WorkspaceJsonConfiguration>(workspaceConfig);
    const nxJson = readJsonFile<NxJsonConfiguration & WorkspaceJsonConfiguration>('nx.json');
    if (workspaceJson.cli || workspaceJson.generators || nxJson.projects || nxJson.defaultProject) {
      const reformattedNxJson = {...nxJson, cli: workspaceJson.cli, generators: workspaceJson.generators} 
      const reformattedWorkspaceJson = {...nxJson, cli: workspaceJson.cli, generators: workspaceJson.generators} 
      writeJsonFile(workspaceConfig, reformattedWorkspaceJson);
      writeJsonFile('nx.json', reformattedNxJson)
    }
  } catch (e) {
    console.error(`Error moving properties between Nx.Json + ${workspaceConfig}`);
    console.error(e);
  }
}
