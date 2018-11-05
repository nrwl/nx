import { execSync } from 'child_process';
import * as path from 'path';
import {
  affectedAppNames,
  AffectedFetcher,
  affectedLibNames,
  affectedProjectNames,
  dependencies,
  Dependency,
  DepGraph,
  ProjectNode,
  ProjectType,
  touchedProjects,
  affectedProjectNamesWithTarget
} from './affected-apps';
import * as fs from 'fs';
import { statSync } from 'fs';
import * as appRoot from 'app-root-path';
import { readJsonFile } from '../utils/fileutils';
import { YargsAffectedOptions } from './affected';

export type ImplicitDependencyEntry = { [key: string]: string[] };
export type ImplicitDependencies = {
  files: ImplicitDependencyEntry;
  projects: ImplicitDependencyEntry;
};

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
    throw new Error('Invalid options provided');
  }
}

function getUncommittedFiles(): string[] {
  return parseGitOutput(`git diff --name-only HEAD .`);
}

function getUntrackedFiles(): string[] {
  return parseGitOutput(`git ls-files --others --exclude-standard`);
}

function getFilesUsingBaseAndHead(base: string, head: string): string[] {
  const mergeBase = execSync(`git merge-base ${base} ${head}`)
    .toString()
    .trim();
  return parseGitOutput(`git diff --name-only ${mergeBase} ${head}`);
}

function getFilesFromShash(sha1: string, sha2: string): string[] {
  return parseGitOutput(`git diff --name-only ${sha1} ${sha2}`);
}

function parseGitOutput(command: string): string[] {
  return execSync(command)
    .toString('utf-8')
    .split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

function getFileLevelImplicitDependencies(
  angularJson: any,
  nxJson: any
): ImplicitDependencyEntry {
  if (!nxJson.implicitDependencies) {
    return {};
  }

  const projects = getProjectNodes(angularJson, nxJson);

  Object.entries<'*' | string[]>(nxJson.implicitDependencies).forEach(
    ([key, value]) => {
      if (value === '*') {
        nxJson.implicitDependencies[key] = projects.map(p => p.name);
      }
    }
  );
  return nxJson.implicitDependencies;
}

function getProjectLevelImplicitDependencies(
  angularJson: any,
  nxJson: any
): ImplicitDependencyEntry {
  const projects = getProjectNodes(angularJson, nxJson);

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
    {} as ImplicitDependencyEntry
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
  angularJson: any,
  nxJson: any
): ImplicitDependencies {
  assertWorkspaceValidity(angularJson, nxJson);

  const files = getFileLevelImplicitDependencies(angularJson, nxJson);
  const projects = getProjectLevelImplicitDependencies(angularJson, nxJson);

  return {
    files,
    projects
  };
}

export function assertWorkspaceValidity(angularJson, nxJson) {
  const angularJsonProjects = Object.keys(angularJson.projects);
  const nxJsonProjects = Object.keys(nxJson.projects);

  if (minus(angularJsonProjects, nxJsonProjects).length > 0) {
    throw new Error(
      `angular.json and nx.json are out of sync. The following projects are missing in nx.json: ${minus(
        angularJsonProjects,
        nxJsonProjects
      ).join(', ')}`
    );
  }

  if (minus(nxJsonProjects, angularJsonProjects).length > 0) {
    throw new Error(
      `angular.json and nx.json are out of sync. The following projects are missing in angular.json: ${minus(
        nxJsonProjects,
        angularJsonProjects
      ).join(', ')}`
    );
  }

  const projects = {
    ...angularJson.projects,
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

export function getProjectNodes(angularJson, nxJson): ProjectNode[] {
  assertWorkspaceValidity(angularJson, nxJson);

  const angularJsonProjects = Object.keys(angularJson.projects);

  return angularJsonProjects.map(key => {
    const p = angularJson.projects[key];
    const tags = nxJson.projects[key].tags;

    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e') ? ProjectType.e2e : ProjectType.app
        : ProjectType.lib;

    let implicitDependencies = nxJson.projects[key].implicitDependencies || [];
    if (projectType === ProjectType.e2e && implicitDependencies.length === 0) {
      implicitDependencies = [key.replace(/-e2e$/, '')];
    }

    return {
      name: key,
      root: p.root,
      type: projectType,
      tags,
      architect: p.architect || {},
      files: allFilesInDir(`${appRoot.path}/${p.root}`),
      implicitDependencies
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

export function readAngularJson(): any {
  return readJsonFile(`${appRoot.path}/angular.json`);
}

export function readNxJson(): any {
  const config = readJsonFile(`${appRoot.path}/nx.json`);
  if (!config.npmScope) {
    throw new Error(`nx.json must define the npmScope property.`);
  }
  return config;
}

export const getAffected = (affectedNamesFetcher: AffectedFetcher) => (
  touchedFiles: string[]
): string[] => {
  const angularJson = readAngularJson();
  const nxJson = readNxJson();
  const projects = getProjectNodes(angularJson, nxJson);
  const implicitDeps = getImplicitDependencies(angularJson, nxJson);
  return affectedNamesFetcher(
    nxJson.npmScope,
    projects,
    implicitDeps,
    f => fs.readFileSync(`${appRoot.path}/${f}`, 'utf-8'),
    touchedFiles
  );
};

export function getAffectedProjectsWithTarget(target: string) {
  return getAffected(affectedProjectNamesWithTarget(target));
}
export const getAffectedApps = getAffected(affectedAppNames);
export const getAffectedProjects = getAffected(affectedProjectNames);
export const getAffectedLibs = getAffected(affectedLibNames);

export function getTouchedProjects(touchedFiles: string[]): string[] {
  const angularJson = readAngularJson();
  const nxJson = readNxJson();
  const projects = getProjectNodes(angularJson, nxJson);
  const implicitDeps = getImplicitDependencies(angularJson, nxJson);
  return touchedProjects(implicitDeps, projects, touchedFiles).filter(p => !!p);
}

export function getAllAppNames() {
  const projects = getProjectNodes(readAngularJson(), readNxJson());
  return projects.filter(p => p.type === ProjectType.app).map(p => p.name);
}

export function getAllLibNames() {
  const projects = getProjectNodes(readAngularJson(), readNxJson());
  return projects.filter(p => p.type === ProjectType.lib).map(p => p.name);
}

export function getAllProjectNamesWithTarget(target: string) {
  const projects = getProjectNodes(readAngularJson(), readNxJson());
  return projects.filter(p => p.architect[target]).map(p => p.name);
}

export function getAllProjectNames() {
  const projects = getProjectNodes(readAngularJson(), readNxJson());
  return projects.map(p => p.name);
}

export function getProjectRoots(projectNames: string[]): string[] {
  const projects = getProjectNodes(readAngularJson(), readNxJson());
  return projectNames.map(name =>
    path.dirname(projects.filter(p => p.name === name)[0].root)
  );
}

export function allFilesInDir(dirName: string): string[] {
  // Ignore files in nested node_modules directories
  if (dirName.endsWith('node_modules')) {
    return [];
  }

  let res = [];
  try {
    fs.readdirSync(dirName).forEach(c => {
      const child = path.join(dirName, c);
      try {
        if (!fs.statSync(child).isDirectory()) {
          // add starting with "apps/myapp/..." or "libs/mylib/..."
          res.push(normalizePath(child.substring(appRoot.path.length + 1)));
        } else if (fs.statSync(child).isDirectory()) {
          res = [...res, ...allFilesInDir(child)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}

export function readDependencies(
  npmScope: string,
  projectNodes: ProjectNode[]
): { [projectName: string]: Dependency[] } {
  const m = lastModifiedAmongProjectFiles();
  if (!directoryExists(`${appRoot.path}/dist`)) {
    fs.mkdirSync(`${appRoot.path}/dist`);
  }
  if (
    !fileExists(`${appRoot.path}/dist/nxdeps.json`) ||
    m > mtime(`${appRoot.path}/dist/nxdeps.json`)
  ) {
    const deps = dependencies(npmScope, projectNodes, f =>
      fs.readFileSync(`${appRoot.path}/${f}`, 'UTF-8')
    );
    fs.writeFileSync(
      `${appRoot.path}/dist/nxdeps.json`,
      JSON.stringify(deps, null, 2),
      'UTF-8'
    );
    return deps;
  } else {
    return readJsonFile(`${appRoot.path}/dist/nxdeps.json`);
  }
}

export function readDepGraph(): DepGraph {
  const angularJson = readAngularJson();
  const nxJson = readNxJson();
  const projectNodes = getProjectNodes(angularJson, nxJson);
  return {
    npmScope: nxJson.npmScope,
    projects: projectNodes,
    deps: readDependencies(nxJson.npmScope, projectNodes)
  };
}

export function lastModifiedAmongProjectFiles() {
  return [
    recursiveMtime(`${appRoot.path}/libs`),
    recursiveMtime(`${appRoot.path}/apps`),
    mtime(`${appRoot.path}/angular.json`),
    mtime(`${appRoot.path}/nx.json`),
    mtime(`${appRoot.path}/tslint.json`),
    mtime(`${appRoot.path}/package.json`)
  ].reduce((a, b) => (a > b ? a : b), 0);
}

function recursiveMtime(dirName: string) {
  let res = mtime(dirName);
  fs.readdirSync(dirName).forEach(c => {
    const child = path.join(dirName, c);
    try {
      if (!fs.statSync(child).isDirectory()) {
        const c = mtime(child);
        if (c > res) {
          res = c;
        }
      } else if (fs.statSync(child).isDirectory()) {
        const c = recursiveMtime(child);
        if (c > res) {
          res = c;
        }
      }
    } catch (e) {}
  });
  return res;
}

function mtime(f: string): number {
  let fd = fs.openSync(f, 'r');
  try {
    return fs.fstatSync(fd).mtime.getTime();
  } finally {
    fs.closeSync(fd);
  }
}

function normalizePath(file: string): string {
  return file.split(path.sep).join('/');
}

function directoryExists(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch (err) {
    return false;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export function normalizedProjectRoot(p: ProjectNode): string {
  return p.root
    .split('/')
    .filter(v => !!v)
    .slice(1)
    .join('/');
}
