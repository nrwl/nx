import { execSync } from 'child_process';
import * as path from 'path';
import {
  getProjectRoots,
  NxArgs,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../utils/command-line-utils';
import { fileExists } from '../utils/fileutils';
import { calculateFileChanges, FileData } from '../project-graph/file-utils';
import * as yargs from 'yargs';
import {
  reformattedWorkspaceJsonOrNull,
  workspaceConfigName,
} from '../config/workspaces';
import { workspaceRoot } from '../utils/workspace-root';
import * as prettier from 'prettier';
import { sortObjectByKeys } from '../utils/object-sort';
import {
  getRootTsConfigFileName,
  getRootTsConfigPath,
} from '../utils/typescript';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import { NxJsonConfiguration } from '../config/nx-json';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { filterAffected } from '../project-graph/affected/affected-project-graph';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { ProjectGraph } from '../config/project-graph';

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
    (p) => `"${p.replace("$", "\\\$")}"`
  );

  // Chunkify the patterns array to prevent crashing the windows terminal
  const chunkList: string[][] = chunkify(patterns, 50);

  switch (command) {
    case 'write':
      const workspaceJsonPath = workspaceConfigName(workspaceRoot);
      if (workspaceJsonPath) {
        updateWorkspaceJsonToMatchFormatVersion(workspaceJsonPath);
        sortWorkspaceJson(workspaceJsonPath);
        movePropertiesToNewLocations(workspaceJsonPath);
      }
      sortTsConfig();
      addRootConfigFiles(chunkList, nxArgs, workspaceJsonPath);
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
  const graph = await createProjectGraphAsync();
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
      ? await getPatternsFromApps(patterns, graph.allWorkspaceFiles, graph)
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
  const graph = await createProjectGraphAsync();
  const affectedGraph = filterAffected(
    graph,
    calculateFileChanges(affectedFiles, allWorkspaceFiles)
  );
  return getPatternsFromProjects(
    Object.keys(affectedGraph.nodes),
    projectGraph
  );
}

function addRootConfigFiles(
  chunkList: string[][],
  nxArgs: NxArgs,
  workspaceJsonPath: string | null
): void {
  if (nxArgs.all) {
    return;
  }
  const chunk = [];
  const addToChunkIfNeeded = (file: string) => {
    if (chunkList.every((c) => !c.includes(`"${file}"`))) {
      chunk.push(file);
    }
  };
  if (workspaceJsonPath) {
    addToChunkIfNeeded(workspaceJsonPath);
  }
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

function chunkify(target: string[], size: number): string[][] {
  return target.reduce((current: string[][], value: string, index: number) => {
    if (index % size === 0) current.push([]);
    current[current.length - 1].push(value);
    return current;
  }, []);
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

function updateWorkspaceJsonToMatchFormatVersion(workspaceJsonPath: string) {
  try {
    const workspaceJson = readJsonFile(workspaceJsonPath);
    const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
    if (reformatted) {
      writeJsonFile(workspaceJsonPath, reformatted);
    }
  } catch (e) {
    console.error(`Failed to format workspace config: ${workspaceJsonPath}`);
    console.error(e);
  }
}

function sortWorkspaceJson(workspaceJsonPath: string) {
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
    const tsconfigPath = getRootTsConfigPath();
    const tsconfig = readJsonFile(tsconfigPath);
    const sortedPaths = sortObjectByKeys(tsconfig.compilerOptions.paths);
    tsconfig.compilerOptions.paths = sortedPaths;
    writeJsonFile(tsconfigPath, tsconfig);
  } catch (e) {
    // catch noop
  }
}

function movePropertiesToNewLocations(workspaceJsonPath: string) {
  try {
    const workspaceJson = readJsonFile<
      NxJsonConfiguration & ProjectsConfigurations
    >(workspaceJsonPath);
    const nxJson = readJsonFile<NxJsonConfiguration & ProjectsConfigurations>(
      'nx.json'
    );
    if (
      workspaceJson.cli ||
      workspaceJson.generators ||
      nxJson.projects ||
      nxJson.defaultProject
    ) {
      nxJson.cli ??= workspaceJson.cli;
      nxJson.generators ??=
        workspaceJson.generators ?? (workspaceJson as any).schematics;
      nxJson.defaultProject ??= workspaceJson.defaultProject;
      delete workspaceJson['cli'];
      delete workspaceJson['generators'];
      delete workspaceJson['defaultProject'];
      moveTagsAndImplicitDepsFromNxJsonToWorkspaceJson(workspaceJson, nxJson);
      writeJsonFile(workspaceJsonPath, workspaceJson);
      writeJsonFile('nx.json', nxJson);
    }
  } catch (e) {
    console.error(
      `Error moving properties between Nx.Json + ${workspaceJsonPath}`
    );
    console.error(e);
  }
}

export function moveTagsAndImplicitDepsFromNxJsonToWorkspaceJson(
  workspaceJson: ProjectsConfigurations,
  nxJson: NxJsonConfiguration & {
    projects: Record<
      string,
      Pick<ProjectConfiguration, 'tags' | 'implicitDependencies'>
    >;
  }
) {
  if (!nxJson.projects) {
    return;
  }
  Object.entries(nxJson.projects).forEach(([project, config]) => {
    workspaceJson.projects[project] = {
      ...workspaceJson.projects[project],
      ...config,
    };
  });
  delete nxJson.projects;
}
