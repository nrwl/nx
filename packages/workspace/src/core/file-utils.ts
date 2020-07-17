import { execSync } from 'child_process';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import * as path from 'path';
import { extname } from 'path';
import { NxArgs } from '../command-line/utils';
import { WorkspaceResults } from '../command-line/workspace-results';
import { appRootPath } from '../utils/app-root';
import { fileExists, readJsonFile } from '../utils/fileutils';
import { jsonDiff } from '../utils/json-diff';
import { ProjectGraphNode } from './project-graph';
import { Environment, NxJson } from './shared-interfaces';
import { defaultFileHasher } from './hasher/file-hasher';
import { performance } from 'perf_hooks';

const ignore = require('ignore');

export interface FileData {
  file: string;
  hash: string;
  ext: string;
}

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
    const fileFullPath = `${appRootPath}${path.sep}${file}`;
    const gitRepositoryPath = execSync('git rev-parse --show-toplevel')
      .toString()
      .trim();
    const filePathInGitRepository = path
      .relative(gitRepositoryPath, fileFullPath)
      .split(path.sep)
      .join('/');
    return !revision
      ? readFileSync(file).toString()
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
  const file = path.relative(appRootPath, filePath).split(path.sep).join('/');
  return {
    file: file,
    hash: defaultFileHasher.hashFile(filePath),
    ext: path.extname(filePath),
  };
}

export function allFilesInDir(
  dirName: string,
  recurse: boolean = true
): FileData[] {
  const ignoredGlobs = getIgnoredGlobs();
  const relDirName = path.relative(appRootPath, dirName);
  if (relDirName && ignoredGlobs.ignores(relDirName)) {
    return [];
  }

  let res = [];
  try {
    fs.readdirSync(dirName).forEach((c) => {
      const child = path.join(dirName, c);
      if (ignoredGlobs.ignores(path.relative(appRootPath, child))) {
        return;
      }
      try {
        const s = fs.statSync(child);
        if (!s.isDirectory()) {
          // add starting with "apps/myapp/..." or "libs/mylib/..."
          res.push(getFileData(child));
        } else if (s.isDirectory() && recurse) {
          res = [...res, ...allFilesInDir(child)];
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

function readFileIfExisting(path: string) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'UTF-8').toString() : '';
}

export function readWorkspaceJson(): any {
  return readJsonFile(`${appRootPath}/${workspaceFileName()}`);
}

export function cliCommand() {
  return workspaceFileName() === 'angular.json' ? 'ng' : 'nx';
}

export function workspaceFileName() {
  if (fileExists(`${appRootPath}/angular.json`)) {
    return 'angular.json';
  } else {
    return 'workspace.json';
  }
}

export function defaultFileRead(filePath: string) {
  return readFileSync(`${appRootPath}/${filePath}`, 'UTF-8');
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

// TODO: Make this list extensible
export function rootWorkspaceFileNames(): string[] {
  return [`package.json`, workspaceFileName(), `nx.json`, `tsconfig.json`];
}

export function rootWorkspaceFileData(): FileData[] {
  return rootWorkspaceFileNames().map((f) =>
    getFileData(`${appRootPath}/${f}`)
  );
}

export function readWorkspaceFiles(): FileData[] {
  const workspaceJson = readWorkspaceJson();
  performance.mark('read workspace files:start');

  if (defaultFileHasher.usesGitForHashing) {
    const r = defaultFileHasher
      .allFiles()
      .map((f) => getFileData(`${appRootPath}/${f}`));
    performance.mark('read workspace files:end');
    performance.measure(
      'read workspace files',
      'read workspace files:start',
      'read workspace files:end'
    );
    return r;
  } else {
    const files = [];
    files.push(...rootWorkspaceFileData());

    // Add known workspace files and directories
    files.push(...allFilesInDir(appRootPath, false));
    files.push(...allFilesInDir(`${appRootPath}/tools`));

    // Add files for workspace projects
    Object.keys(workspaceJson.projects).forEach((projectName) => {
      const project = workspaceJson.projects[projectName];
      files.push(...allFilesInDir(`${appRootPath}/${project.root}`));
    });
    performance.mark('read workspace files:end');
    performance.measure(
      'read workspace files',
      'read workspace files:start',
      'read workspace files:end'
    );
    return files;
  }
}

export function readEnvironment(
  target: string,
  projects: Record<string, ProjectGraphNode>
): Environment {
  const nxJson = readNxJson();
  const workspaceJson = readWorkspaceJson();
  const workspaceResults = new WorkspaceResults(target, projects);

  return { nxJson, workspaceJson, workspaceResults };
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

export function filesChanged(a: FileData[], b: FileData[]) {
  if (a.length !== b.length) return true;
  const sortedA = a.sort((x, y) => x.file.localeCompare(y.file));
  const sortedB = b.sort((x, y) => x.file.localeCompare(y.file));

  for (let i = 0; i < sortedA.length; ++i) {
    if (sortedA[i].file !== sortedB[i].file) return true;
    if (sortedA[i].hash !== sortedB[i].hash) return true;
  }
  return false;
}
