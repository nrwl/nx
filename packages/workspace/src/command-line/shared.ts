import { execSync } from 'child_process';
import * as fs from 'fs';
import { appRootPath } from '../utils/app-root';
import { readJsonFile } from '../utils/fileutils';
import { YargsAffectedOptions } from './run-tasks/affected';
import { output } from './output';
import { allFilesInDir, FileData } from './file-utils';
import {
  createProjectGraph,
  ProjectGraphNode,
  ProjectType
} from './project-graph';

export const TEN_MEGABYTES = 1024 * 10000;
export type ImplicitDependencyEntry = { [key: string]: '*' | string[] };
export type NormalizedImplicitDependencyEntry = { [key: string]: string[] };
export type ImplicitDependencies = {
  files: NormalizedImplicitDependencyEntry;
  projects: NormalizedImplicitDependencyEntry;
};

export interface NxJson {
  implicitDependencies?: ImplicitDependencyEntry;
  npmScope: string;
  projects: {
    [projectName: string]: NxJsonProjectConfig;
  };
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      runner: string;
      options?: unknown;
    };
  };
}

export interface NxJsonProjectConfig {
  implicitDependencies?: string[];
  tags?: string[];
}

export function printArgsWarning(options: YargsAffectedOptions) {
  const { files, uncommitted, untracked, base, head, all } = options;

  if (
    !files &&
    !uncommitted &&
    !untracked &&
    !base &&
    !head &&
    !all &&
    options._.length < 2
  ) {
    output.note({
      title: `Affected criteria defaulted to --base=${output.bold(
        'master'
      )} --head=${output.bold('HEAD')}`
    });
  }

  if (all) {
    output.warn({
      title: `Running affected:* commands with --all can result in very slow builds.`,
      bodyLines: [
        output.bold('--all') +
          ' is not meant to be used for any sizable project or to be used in CI.',
        '',
        output.colors.gray(
          'Learn more about checking only what is affected: '
        ) + 'https://nx.dev/guides/monorepo-affected.'
      ]
    });
  }
}

export function parseFiles(options: YargsAffectedOptions): { files: string[] } {
  const { files, uncommitted, untracked, base, head } = options;

  if (files) {
    return {
      files
    };
  } else if (uncommitted) {
    return {
      files: getUncommittedFiles()
    };
  } else if (untracked) {
    return {
      files: getUntrackedFiles()
    };
  } else if (base && head) {
    return {
      files: getFilesUsingBaseAndHead(base, head)
    };
  } else if (base) {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead(base, 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles()
        ])
      )
    };
  } else if (options._.length >= 2) {
    return {
      files: getFilesFromShash(options._[1], options._[2])
    };
  } else {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead('master', 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles()
        ])
      )
    };
  }
}

function getUncommittedFiles(): string[] {
  return parseGitOutput(`git diff --name-only --relative HEAD .`);
}

function getUntrackedFiles(): string[] {
  return parseGitOutput(`git ls-files --others --exclude-standard`);
}

function getFilesUsingBaseAndHead(base: string, head: string): string[] {
  const mergeBase = execSync(`git merge-base ${base} ${head}`, {
    maxBuffer: TEN_MEGABYTES
  })
    .toString()
    .trim();
  return parseGitOutput(`git diff --name-only --relative ${mergeBase} ${head}`);
}

function getFilesFromShash(sha1: string, sha2: string): string[] {
  return parseGitOutput(`git diff --name-only --relative ${sha1} ${sha2}`);
}

function parseGitOutput(command: string): string[] {
  return execSync(command, { maxBuffer: TEN_MEGABYTES })
    .toString('utf-8')
    .split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

function detectAndSetInvalidProjectValues(
  map: Map<string, string[]>,
  sourceName: string,
  desiredProjectNames: string[],
  validProjects: any
) {
  const invalidProjects = desiredProjectNames.filter(
    projectName => !validProjects[projectName]
  );
  if (invalidProjects.length > 0) {
    map.set(sourceName, invalidProjects);
  }
}

export function assertWorkspaceValidity(workspaceJson, nxJson) {
  const workspaceJsonProjects = Object.keys(workspaceJson.projects);
  const nxJsonProjects = Object.keys(nxJson.projects);

  if (minus(workspaceJsonProjects, nxJsonProjects).length > 0) {
    throw new Error(
      `${workspaceFileName()} and nx.json are out of sync. The following projects are missing in nx.json: ${minus(
        workspaceJsonProjects,
        nxJsonProjects
      ).join(', ')}`
    );
  }

  if (minus(nxJsonProjects, workspaceJsonProjects).length > 0) {
    throw new Error(
      `${workspaceFileName()} and nx.json are out of sync. The following projects are missing in ${workspaceFileName()}: ${minus(
        nxJsonProjects,
        workspaceJsonProjects
      ).join(', ')}`
    );
  }

  const projects = {
    ...workspaceJson.projects,
    ...nxJson.projects
  };

  const invalidImplicitDependencies = new Map<string, string[]>();

  Object.entries<'*' | string[]>(nxJson.implicitDependencies || {})
    .filter(([_, val]) => val !== '*') // These are valid since it is calculated
    .reduce((map, [filename, projectNames]: [string, string[]]) => {
      detectAndSetInvalidProjectValues(map, filename, projectNames, projects);
      return map;
    }, invalidImplicitDependencies);

  nxJsonProjects
    .filter(nxJsonProjectName => {
      const project = nxJson.projects[nxJsonProjectName];
      return !!project.implicitDependencies;
    })
    .reduce((map, nxJsonProjectName) => {
      const project = nxJson.projects[nxJsonProjectName];
      detectAndSetInvalidProjectValues(
        map,
        nxJsonProjectName,
        project.implicitDependencies,
        projects
      );
      return map;
    }, invalidImplicitDependencies);

  if (invalidImplicitDependencies.size === 0) {
    return;
  }

  let message = `The following implicitDependencies specified in nx.json are invalid:
  `;
  invalidImplicitDependencies.forEach((projectNames, key) => {
    const str = `  ${key}
    ${projectNames.map(projectName => `    ${projectName}`).join('\n')}`;
    message += str;
  });

  throw new Error(message);
}

function minus(a: string[], b: string[]): string[] {
  const res = [];
  a.forEach(aa => {
    if (!b.find(bb => bb === aa)) {
      res.push(aa);
    }
  });
  return res;
}

export function cliCommand() {
  return workspaceFileName() === 'angular.json' ? 'ng' : 'nx';
}

export function readWorkspaceJson(): any {
  return readJsonFile(`${appRootPath}/${workspaceFileName()}`);
}

export function workspaceFileName() {
  const packageJson = readPackageJson();
  if (
    packageJson.devDependencies['@angular/cli'] ||
    packageJson.dependencies['@angular/cli']
  ) {
    return 'angular.json';
  } else {
    return 'workspace.json';
  }
}

export function readPackageJson(): any {
  return readJsonFile(`${appRootPath}/package.json`);
}

export function readNxJson(): NxJson {
  const config = readJsonFile<NxJson>(`${appRootPath}/nx.json`);
  if (!config.npmScope) {
    throw new Error(`nx.json must define the npmScope property.`);
  }
  return config;
}

export function readWorkspaceFiles(): FileData[] {
  const workspaceJson = readWorkspaceJson();
  const files = [];

  // Add known workspace files and directories
  files.push(...allFilesInDir(appRootPath, false));
  files.push(...allFilesInDir(`${appRootPath}/tools`));

  // Add files for workspace projects
  Object.keys(workspaceJson.projects).forEach(projectName => {
    const project = workspaceJson.projects[projectName];
    files.push(...allFilesInDir(`${appRootPath}/${project.root}`));
  });

  return files;
}

export function getProjectNodes(
  workspaceJson: any,
  nxJson: NxJson
): ProjectGraphNode[] {
  const graph = createProjectGraph(workspaceJson, nxJson);
  return Object.values(graph.nodes);
}

export function normalizedProjectRoot(p: ProjectGraphNode): string {
  if (p.data && p.data.root) {
    return p.data.root
      .split('/')
      .filter(v => !!v)
      .slice(1)
      .join('/');
  } else {
    return '';
  }
}

export function getProjectRoots(projectNames: string[]): string[] {
  const { projects } = readWorkspaceJson();
  return projectNames.map(name => projects[name].root);
}

/**
 * Returns the time when file was last modified
 * Returns -Infinity for a non-existent file
 */
export function mtime(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return -Infinity;
  }
  return fs.statSync(filePath).mtimeMs;
}
