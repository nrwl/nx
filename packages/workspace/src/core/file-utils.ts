import * as path from 'path';
import * as fs from 'fs';
import { appRootPath } from '../utils/app-root';
import { extname } from 'path';
import { jsonDiff } from '../utils/json-diff';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { readJsonFile } from '../utils/fileutils';
import { Environment, NxJson } from './shared-interfaces';
import { ProjectGraphNode } from './project-graph';
import { WorkspaceResults } from '../command-line/workspace-results';
import { NxArgs } from '../command-line/utils';

const ignore = require('ignore');

export interface FileData {
  file: string;
  mtime: number;
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
  ) => string = defaultReadFileAtRevision
): FileChange[] {
  return files.map(f => {
    const ext = extname(f);
    const _mtime = mtime(`${appRootPath}/${f}`);
    // Memoize results so we don't recalculate on successive invocation.

    return {
      file: f,
      ext,
      mtime: _mtime,
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
      }
    };
  });
}

export const TEN_MEGABYTES = 1024 * 10000;

function defaultReadFileAtRevision(
  file: string,
  revision: void | string
): string {
  try {
    return !revision
      ? readFileSync(file).toString()
      : execSync(`git show ${revision}:${file}`, {
          maxBuffer: TEN_MEGABYTES
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
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
            file: path
              .relative(appRootPath, child)
              .split(path.sep)
              .join('/'),
            ext: path.extname(child),
            mtime: s.mtimeMs
          });
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

export function readEnvironment(target: string): Environment {
  const nxJson = readNxJson();
  const workspaceJson = readWorkspaceJson();
  const workspace = new WorkspaceResults(target);

  return { nxJson, workspaceJson, workspace };
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
