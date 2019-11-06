import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { appRootPath } from '../utils/app-root';
import { readJsonFile } from '../utils/fileutils';
import { output } from './output';
import {
  ImplicitDependencies,
  NormalizedImplicitDependencyEntry,
  NxJson,
  PackageJson,
  ProjectNode,
  ProjectType,
  YargsAffectedOptions
} from './shared-models';

const ignore = require('ignore');

export const TEN_MEGABYTES = 1024 * 10000;

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

  const normalized: NormalizedImplicitDependencyEntry = {};

  Object.entries(nxJson.implicitDependencies).forEach(([key, value]) => {
    if (value === '*') {
      normalized[key] = projects.map(p => p.name);
    } else if (Array.isArray(value)) {
      normalized[key] = value;
    }
  });
  return normalized;
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

  Object.entries(nxJson.implicitDependencies || {})
    .filter(([_, val]) => Array.isArray(val)) // These are valid since it is calculated
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

export function readPackageJson(): PackageJson {
  return readJsonFile(`${appRootPath}/package.json`);
}

export function readNxJson(): NxJson {
  const config = readJsonFile<NxJson>(`${appRootPath}/nx.json`);
  if (!config.npmScope) {
    throw new Error(`nx.json must define the npmScope property.`);
  }
  return config;
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
