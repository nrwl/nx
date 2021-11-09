import {
  toOldFormatOrNull,
  WorkspaceJsonConfiguration,
  Workspaces,
} from '@nrwl/tao/src/shared/workspace';
import type {
  FileData,
  NxJsonConfiguration,
  ProjectGraphNode,
} from '@nrwl/devkit';
import { ProjectFileMap, stripIndents } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import { performance } from 'perf_hooks';
import type { NxArgs } from '../command-line/utils';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { appendArray } from '../utilities/array';
import { fileExists, readJsonFile } from '../utilities/fileutils';
import { jsonDiff } from '../utilities/json-diff';
import { defaultFileHasher } from './hasher/file-hasher';
import type { Environment } from './shared-interfaces';

const ignore = require('ignore');

export interface Change {
  type: string;
}

export interface FileChange<T extends Change = Change> extends FileData {
  getChanges: () => T[];
}

export class WholeFileChange implements Change {
  type = 'WholeFileChange';
}

export function isWholeFileChange(change: Change): change is WholeFileChange {
  return change.type === 'WholeFileChange';
}

export function calculateFileChanges(
  files: string[],
  nxArgs?: NxArgs,
  readFileAtRevision: (
    f: string,
    r: void | string
  ) => string = defaultReadFileAtRevision,
  ignore = getIgnoredGlobs()
): FileChange[] {
  if (ignore) {
    files = files.filter((f) => !ignore.ignores(f));
  }

  return files.map((f) => {
    const ext = extname(f);
    const hash = defaultFileHasher.hashFile(f);

    return {
      file: f,
      ext,
      hash,
      getChanges: (): Change[] => {
        if (!nxArgs) {
          return [new WholeFileChange()];
        }

        if (nxArgs.files && nxArgs.files.includes(f)) {
          return [new WholeFileChange()];
        }
        switch (ext) {
          case '.json':
            const atBase = readFileAtRevision(f, nxArgs.base);
            const atHead = readFileAtRevision(f, nxArgs.head);

            try {
              return jsonDiff(JSON.parse(atBase), JSON.parse(atHead));
            } catch (e) {
              return [new WholeFileChange()];
            }
          default:
            return [new WholeFileChange()];
        }
      },
    };
  });
}

export const TEN_MEGABYTES = 1024 * 10000;

function defaultReadFileAtRevision(
  file: string,
  revision: void | string
): string {
  try {
    const fileFullPath = `${appRootPath}${sep}${file}`;
    const gitRepositoryPath = execSync('git rev-parse --show-toplevel')
      .toString()
      .trim();
    const filePathInGitRepository = relative(gitRepositoryPath, fileFullPath)
      .split(sep)
      .join('/');
    return !revision
      ? readFileSync(file, 'utf-8')
      : execSync(`git show ${revision}:${filePathInGitRepository}`, {
          maxBuffer: TEN_MEGABYTES,
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
}

function getFileData(filePath: string): FileData {
  const file = relative(appRootPath, filePath).split(sep).join('/');
  return {
    file,
    hash: defaultFileHasher.hashFile(filePath),
  };
}

function allFilesInDir(
  dirName: string,
  recurse: boolean = true,
  ignoredGlobs: any
): FileData[] {
  const relDirName = relative(appRootPath, dirName);
  if (relDirName && ignoredGlobs.ignores(relDirName)) {
    return [];
  }

  let res = [];
  try {
    readdirSync(dirName).forEach((c) => {
      const child = join(dirName, c);
      if (ignoredGlobs.ignores(relative(appRootPath, child))) {
        return;
      }
      try {
        const s = statSync(child);
        if (!s.isDirectory()) {
          // add starting with "apps/myapp/..." or "libs/mylib/..."
          res.push(getFileData(child));
        } else if (s.isDirectory() && recurse) {
          res = [...res, ...allFilesInDir(child, true, ignoredGlobs)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}

function getIgnoredGlobs() {
  const ig = ignore();
  ig.add(readFileIfExisting(`${appRootPath}/.gitignore`));
  ig.add(readFileIfExisting(`${appRootPath}/.nxignore`));
  return ig;
}

export function readFileIfExisting(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

export function readWorkspaceJson(): WorkspaceJsonConfiguration {
  return readWorkspaceConfig({
    format: 'nx',
    path: appRootPath,
  });
}

export function readWorkspaceConfig(opts: {
  format: 'angularCli' | 'nx';
  path?: string;
}) {
  const ws = new Workspaces(opts.path || process.cwd());
  const json = ws.readWorkspaceConfiguration();
  if (opts.format === 'angularCli') {
    const formatted = toOldFormatOrNull(json);
    return formatted ?? json;
  } else {
    return json;
  }
}

export function workspaceFileName() {
  if (fileExists(`${appRootPath}/angular.json`)) {
    return 'angular.json';
  } else {
    return 'workspace.json';
  }
}

export function defaultFileRead(filePath: string): string | null {
  return readFileSync(join(appRootPath, filePath), 'utf-8');
}

export function readPackageJson(): any {
  return readJsonFile(`${appRootPath}/package.json`);
}

export function readNxJson(
  path: string = `${appRootPath}/nx.json`
): NxJsonConfiguration {
  const config = readJsonFile<NxJsonConfiguration>(path);
  if (!config.npmScope) {
    throw new Error(`nx.json must define the npmScope property.`);
  }

  const nxJsonExtends = readNxJsonExtends(config as any);
  if (nxJsonExtends) {
    return { ...nxJsonExtends, ...config };
  } else {
    return config;
  }
}

function readNxJsonExtends(nxJson: { extends?: string }) {
  if (nxJson.extends) {
    const extendsPath = nxJson.extends;
    try {
      return readJsonFile(require.resolve(extendsPath));
    } catch (e) {
      throw new Error(`Unable to resolve nx.json extends. Error: ${e.message}`);
    }
  } else {
    return null;
  }
}

export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxJson = readNxJson();
  return {
    appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
  };
}

// TODO: Make this list extensible
export function rootWorkspaceFileNames(): string[] {
  return [`package.json`, workspaceFileName(), `nx.json`, `tsconfig.base.json`];
}

export function rootWorkspaceFileData(): FileData[] {
  return rootWorkspaceFileNames().map((f) =>
    getFileData(`${appRootPath}/${f}`)
  );
}

function readWorkspaceFiles(): FileData[] {
  defaultFileHasher.ensureInitialized();
  performance.mark('read workspace files:start');

  if (defaultFileHasher.usesGitForHashing) {
    const ignoredGlobs = getIgnoredGlobs();
    const r = Array.from(defaultFileHasher.workspaceFiles)
      .filter((f) => !ignoredGlobs.ignores(f))
      .map((f) => getFileData(`${appRootPath}/${f}`));
    performance.mark('read workspace files:end');
    performance.measure(
      'read workspace files',
      'read workspace files:start',
      'read workspace files:end'
    );
    r.sort((x, y) => x.file.localeCompare(y.file));
    return r;
  } else {
    const r = [];
    const ignoredGlobs = getIgnoredGlobs();
    ignoredGlobs.add(stripIndents`
      node_modules
      tmp
      dist
      build    
    `);
    appendArray(r, allFilesInDir(appRootPath, true, ignoredGlobs));
    performance.mark('read workspace files:end');
    performance.measure(
      'read workspace files',
      'read workspace files:start',
      'read workspace files:end'
    );
    r.sort((x, y) => x.file.localeCompare(y.file));
    return r;
  }
}

function sortProjects(workspaceJson: any) {
  // Sorting here so `apps/client-e2e` comes before `apps/client` and has
  // a chance to match prefix first.
  return Object.keys(workspaceJson.projects).sort((a, b) => {
    const projectA = workspaceJson.projects[a];
    const projectB = workspaceJson.projects[b];
    if (!projectA.root) return -1;
    if (!projectB.root) return -1;
    return projectA.root.length > projectB.root.length ? -1 : 1;
  });
}

export function createProjectFileMap(
  workspaceJson: any,
  allWorkspaceFiles?: FileData[]
): { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] } {
  allWorkspaceFiles = allWorkspaceFiles || readWorkspaceFiles();
  const projectFileMap: ProjectFileMap = {};
  const sortedProjects = sortProjects(workspaceJson);
  const seen = new Set();

  for (const projectName of sortedProjects) {
    projectFileMap[projectName] = [];
  }
  for (const f of allWorkspaceFiles) {
    if (seen.has(f.file)) continue;
    seen.add(f.file);
    for (const projectName of sortedProjects) {
      const p = workspaceJson.projects[projectName];
      if (f.file.startsWith(p.root || p.sourceRoot)) {
        projectFileMap[projectName].push(f);
        break;
      }
    }
  }
  return { projectFileMap, allWorkspaceFiles };
}

export function updateProjectFileMap(
  workspaceJson: any,
  projectFileMap: ProjectFileMap,
  allWorkspaceFiles: FileData[],
  updatedFiles: Map<string, string>,
  deletedFiles: string[]
): { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] } {
  const ignore = getIgnoredGlobs();
  const sortedProjects = sortProjects(workspaceJson);

  for (const f of updatedFiles.keys()) {
    if (ignore.ignores(f)) continue;
    for (const projectName of sortedProjects) {
      const p = workspaceJson.projects[projectName];
      if (f.startsWith(p.root || p.sourceRoot)) {
        const fileData: FileData = projectFileMap[projectName].find(
          (t) => t.file === f
        );
        if (fileData) {
          fileData.hash = updatedFiles.get(f);
        } else {
          projectFileMap[projectName].push({
            file: f,
            hash: updatedFiles.get(f),
          });
        }
        break;
      }
    }

    const fileData: FileData = allWorkspaceFiles.find((t) => t.file === f);
    if (fileData) {
      fileData.hash = updatedFiles.get(f);
    } else {
      allWorkspaceFiles.push({
        file: f,
        hash: updatedFiles.get(f),
      });
    }
  }

  for (const f of deletedFiles) {
    if (ignore.ignores(f)) continue;
    for (const projectName of sortedProjects) {
      const p = workspaceJson.projects[projectName];
      if (f.startsWith(p.root || p.sourceRoot)) {
        const index = projectFileMap[projectName].findIndex(
          (t) => t.file === f
        );
        if (index > -1) {
          projectFileMap[projectName].splice(index, 1);
        }
        break;
      }
    }
    const index = allWorkspaceFiles.findIndex((t) => t.file === f);
    if (index > -1) {
      allWorkspaceFiles.splice(index, 1);
    }
  }
  return { projectFileMap, allWorkspaceFiles };
}

export function readEnvironment(
  target: string,
  projects: Record<string, ProjectGraphNode>
): Environment {
  const nxJson = readNxJson();
  const workspaceJson = readWorkspaceJson();
  return { nxJson, workspaceJson, workspaceResults: null } as any;
}

export function normalizedProjectRoot(p: ProjectGraphNode): string {
  if (p.data && p.data.root) {
    const path = p.data.root.split('/').filter((v) => !!v);
    if (path.length === 1) {
      return path[0];
    }
    // Remove the first part of the path, usually 'libs'
    return path.slice(1).join('/');
  } else {
    return '';
  }
}

// Original Exports
export { FileData };
