import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { readJsonFile } from '../utils/fileutils';
import { YargsAffectedOptions } from './run-tasks/affected';
import { Deps, readDependencies } from './deps-calculator';
import { touchedProjects } from './touched';
import { output } from './output';

const ignore = require('ignore');

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

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib'
}

export type ProjectNode = {
  name: string;
  root: string;
  type: ProjectType;
  tags: string[];
  files: string[];
  architect: { [k: string]: any };
  implicitDependencies: string[];
  fileMTimes: {
    [filePath: string]: number;
  };
};

export interface ProjectMap {
  [projectName: string]: ProjectNode;
}

export interface ProjectStates {
  [projectName: string]: {
    affected: boolean;
    touched: boolean;
  };
}

export interface DependencyGraph {
  projects: ProjectMap;
  dependencies: Deps;
  roots: string[];
}

export interface ProjectMetadata {
  dependencyGraph: DependencyGraph;

  projectStates: ProjectStates;
}

function readFileIfExisting(path: string) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'UTF-8').toString() : '';
}

function getIgnoredGlobs() {
  const ig = ignore();

  ig.add(readFileIfExisting(`${appRootPath}/.gitignore`));
  ig.add(readFileIfExisting(`${appRootPath}/.nxignore`));

  return ig;
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

function getFileLevelImplicitDependencies(
  projects: ProjectNode[],
  nxJson: NxJson
): NormalizedImplicitDependencyEntry {
  if (!nxJson.implicitDependencies) {
    return {};
  }

  Object.entries<'*' | string[]>(nxJson.implicitDependencies).forEach(
    ([key, value]) => {
      if (value === '*') {
        nxJson.implicitDependencies[key] = projects.map(p => p.name);
      }
    }
  );
  return <NormalizedImplicitDependencyEntry>nxJson.implicitDependencies;
}

function getProjectLevelImplicitDependencies(
  projects: ProjectNode[]
): NormalizedImplicitDependencyEntry {
  const implicitDependencies = projects.reduce(
    (memo, project) => {
      project.implicitDependencies.forEach(dep => {
        if (memo[dep]) {
          memo[dep].add(project.name);
        } else {
          memo[dep] = new Set([project.name]);
        }
      });

      return memo;
    },
    {} as { [key: string]: Set<string> }
  );

  return Object.entries(implicitDependencies).reduce(
    (memo, [key, val]) => {
      memo[key] = Array.from(val);
      return memo;
    },
    {} as NormalizedImplicitDependencyEntry
  );
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

export function getImplicitDependencies(
  projects: ProjectNode[],
  workspaceJson: any,
  nxJson: NxJson
): ImplicitDependencies {
  assertWorkspaceValidity(workspaceJson, nxJson);

  const implicitFileDeps = getFileLevelImplicitDependencies(projects, nxJson);
  const implicitProjectDeps = getProjectLevelImplicitDependencies(projects);

  return {
    files: implicitFileDeps,
    projects: implicitProjectDeps
  };
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

export function getProjectNodes(
  workspaceJson: any,
  nxJson: NxJson
): ProjectNode[] {
  assertWorkspaceValidity(workspaceJson, nxJson);

  const workspaceJsonProjects = Object.keys(workspaceJson.projects);

  return workspaceJsonProjects.map(key => {
    const p = workspaceJson.projects[key];
    const tags = nxJson.projects[key].tags;

    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e')
          ? ProjectType.e2e
          : ProjectType.app
        : ProjectType.lib;

    let implicitDependencies = nxJson.projects[key].implicitDependencies || [];
    if (projectType === ProjectType.e2e && implicitDependencies.length === 0) {
      implicitDependencies = [key.replace(/-e2e$/, '')];
    }

    const filesWithMTimes = allFilesInDir(`${appRootPath}/${p.root}`);
    const fileMTimes = {};
    filesWithMTimes.forEach(f => {
      fileMTimes[f.file] = f.mtime;
    });

    return {
      name: key,
      root: p.root,
      type: projectType,
      tags,
      architect: p.architect || {},
      files: filesWithMTimes.map(f => f.file),
      implicitDependencies,
      fileMTimes
    };
  });
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

export function getProjectMetadata(
  touchedFiles: string[],
  withDeps: boolean
): ProjectMetadata {
  const workspaceJson = readWorkspaceJson();
  const nxJson = readNxJson();
  const projectNodes = getProjectNodes(workspaceJson, nxJson);
  const implicitDeps = getImplicitDependencies(
    projectNodes,
    workspaceJson,
    nxJson
  );
  const dependencies = readDependencies(nxJson.npmScope, projectNodes);
  const tp = touchedProjects(implicitDeps, projectNodes, touchedFiles);
  return createProjectMetadata(projectNodes, dependencies, tp, withDeps);
}

export function createProjectMetadata(
  projectNodes: ProjectNode[],
  dependencies: Deps,
  touchedProjects: string[],
  withDeps: boolean
): ProjectMetadata {
  const projectStates: ProjectStates = {};
  const projects: ProjectMap = {};

  projectNodes.forEach(project => {
    projectStates[project.name] = {
      touched: false,
      affected: false
    };
    projects[project.name] = project;
  });
  const reverseDeps = reverseDependencies(dependencies);
  const roots = projectNodes
    .filter(project => !reverseDeps[project.name])
    .map(project => project.name);

  touchedProjects.forEach(projectName => {
    projectStates[projectName].touched = true;
    setAffected(
      projectName,
      simplifyDeps(dependencies),
      reverseDeps,
      projectStates,
      withDeps
    );
  });

  return {
    dependencyGraph: {
      projects,
      dependencies,
      roots
    },
    projectStates
  };
}

function simplifyDeps(dependencies: Deps): { [projectName: string]: string[] } {
  const res = {};
  Object.keys(dependencies).forEach(d => {
    res[d] = dependencies[d].map(dd => dd.projectName);
  });
  return res;
}

function reverseDependencies(
  dependencies: Deps
): { [projectName: string]: string[] } {
  const reverseDepSets: { [projectName: string]: Set<string> } = {};
  Object.entries(dependencies).forEach(([depName, deps]) => {
    deps.forEach(dep => {
      reverseDepSets[dep.projectName] =
        reverseDepSets[dep.projectName] || new Set<string>();
      reverseDepSets[dep.projectName].add(depName);
    });
  });
  return Object.entries(reverseDepSets).reduce(
    (reverseDeps, [name, depSet]) => {
      reverseDeps[name] = Array.from(depSet);
      return reverseDeps;
    },
    {} as {
      [projectName: string]: string[];
    }
  );
}

function setAffected(
  projectName: string,
  deps: { [projectName: string]: string[] },
  reverseDeps: { [projectName: string]: string[] },
  projectStates: ProjectStates,
  withDeps: boolean
) {
  projectStates[projectName].affected = true;
  const rdep = reverseDeps[projectName] || [];
  rdep.forEach(dep => {
    // If a dependency is already marked as affected, it means it has been visited
    if (projectStates[dep].affected) {
      return;
    }
    setAffected(dep, deps, reverseDeps, projectStates, withDeps);
  });

  if (withDeps) {
    setDeps(projectName, deps, reverseDeps, projectStates);
  }
}

function setDeps(
  projectName: string,
  deps: { [projectName: string]: string[] },
  reverseDeps: { [projectName: string]: string[] },
  projectStates: ProjectStates
) {
  projectStates[projectName].affected = true;
  deps[projectName].forEach(dep => {
    // If a dependency is already marked as affected, it means it has been visited
    if (projectStates[dep].affected) {
      return;
    }
    setDeps(dep, deps, reverseDeps, projectStates);
  });
}

export function getProjectRoots(projectNames: string[]): string[] {
  const { projects } = readWorkspaceJson();
  return projectNames.map(name => projects[name].root);
}

export function allFilesInDir(
  dirName: string
): { file: string; mtime: number }[] {
  const ignoredGlobs = getIgnoredGlobs();
  if (ignoredGlobs.ignores(path.relative(appRootPath, dirName))) {
    return [];
  }

  let res = [];
  try {
    fs.readdirSync(dirName).forEach(c => {
      const child = path.join(dirName, c);
      if (ignoredGlobs.ignores(path.relative(appRootPath, child))) {
        return;
      }
      try {
        const s = fs.statSync(child);
        if (!s.isDirectory()) {
          // add starting with "apps/myapp/..." or "libs/mylib/..."
          res.push({
            file: normalizePath(path.relative(appRootPath, child)),
            mtime: s.mtimeMs
          });
        } else if (s.isDirectory()) {
          res = [...res, ...allFilesInDir(child)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}

export function lastModifiedAmongProjectFiles(projects: ProjectNode[]) {
  return Math.max(
    ...[
      ...projects.map(project => getProjectMTime(project)),
      mtime(`${appRootPath}/${workspaceFileName()}`),
      mtime(`${appRootPath}/nx.json`),
      mtime(`${appRootPath}/tslint.json`),
      mtime(`${appRootPath}/package.json`)
    ]
  );
}

export function getProjectMTime(project: ProjectNode): number {
  return Math.max(...Object.values(project.fileMTimes));
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

function normalizePath(file: string): string {
  return file.split(path.sep).join('/');
}

export function normalizedProjectRoot(p: ProjectNode): string {
  return p.root
    .split('/')
    .filter(v => !!v)
    .slice(1)
    .join('/');
}
