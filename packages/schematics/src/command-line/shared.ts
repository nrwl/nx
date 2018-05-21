import { execSync } from 'child_process';
import * as path from 'path';
import {
  affectedAppNames,
  affectedE2eNames,
  AffectedFetcher,
  affectedProjectNames,
  dependencies,
  Dependency,
  DepGraph,
  ProjectNode,
  ProjectType,
  touchedProjects
} from './affected-apps';
import * as fs from 'fs';
import { statSync } from 'fs';
import * as appRoot from 'app-root-path';
import { readJsonFile } from '../utils/fileutils';

export function parseFiles(
  args: string[]
): { files: string[]; rest: string[] } {
  let unnamed = [];
  let named = [];
  args.forEach(a => {
    if (a.startsWith('--') || a.startsWith('-')) {
      named.push(a);
    } else {
      unnamed.push(a);
    }
  });

  const dashDashFiles = named.filter(a => a.startsWith('--files='))[0];
  const uncommitted = named.some(a => a === '--uncommitted');
  const untracked = named.some(a => a === '--untracked');
  const base = named
    .filter(a => a.startsWith('--base'))
    .map(a => a.substring(7))[0];
  const head = named
    .filter(a => a.startsWith('--head'))
    .map(a => a.substring(7))[0];

  if (dashDashFiles) {
    named.splice(named.indexOf(dashDashFiles), 1);
    return {
      files: parseDashDashFiles(dashDashFiles),
      rest: [...unnamed, ...named]
    };
  } else if (uncommitted) {
    return {
      files: getUncommittedFiles(),
      rest: [...unnamed, ...named]
    };
  } else if (untracked) {
    return {
      files: getUntrackedFiles(),
      rest: [...unnamed, ...named]
    };
  } else if (base && head) {
    return {
      files: getFilesUsingBaseAndHead(base, head),
      rest: [...unnamed, ...named]
    };
  } else if (unnamed.length >= 2) {
    return {
      files: getFilesFromShash(unnamed[0], unnamed[1]),
      rest: [...unnamed.slice(2), ...named]
    };
  } else {
    throw new Error('Invalid options provided');
  }
}

function parseDashDashFiles(dashDashFiles: string): string[] {
  let f = dashDashFiles.substring(8); // remove --files=
  if (f.startsWith('"') || f.startsWith("'")) {
    f = f.substring(1, f.length - 1);
  }
  return f.split(',').map(f => f.trim());
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

export function getProjectNodes(angularJson, nxJson) {
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

  return angularJsonProjects.map(key => {
    const p = angularJson.projects[key];
    const tags = nxJson.projects[key].tags;
    return {
      name: key,
      root: p.root,
      type:
        p.projectType === 'application'
          ? key.endsWith('-e2e') ? ProjectType.e2e : ProjectType.app
          : ProjectType.lib,
      tags,
      architect: p.architect,
      files: allFilesInDir(`${appRoot.path}/${p.root}`)
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
  const nxJson = readNxJson();
  const projects = getProjectNodes(readAngularJson(), nxJson);

  return affectedNamesFetcher(
    nxJson.npmScope,
    projects,
    f => fs.readFileSync(`${appRoot.path}/${f}`, 'utf-8'),
    touchedFiles
  );
};

export const getAffectedApps = getAffected(affectedAppNames);
export const getAffectedE2e = getAffected(affectedE2eNames);
export const getAffectedProjects = getAffected(affectedProjectNames);

export function getTouchedProjects(touchedFiles: string[]): string[] {
  return touchedProjects(
    getProjectNodes(readAngularJson(), readNxJson()),
    touchedFiles
  ).filter(p => !!p);
}

export function getProjectRoots(projectNames: string[]): string[] {
  const projects = getProjectNodes(readAngularJson(), readNxJson());
  return projectNames.map(name =>
    path.dirname(projects.filter(p => p.name === name)[0].root)
  );
}

export function allFilesInDir(dirName: string): string[] {
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
