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
import { ProjectFileMap, stripIndents, readJsonFile } from '@nrwl/devkit';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import { performance } from 'perf_hooks';
import type { NxArgs } from '../command-line/utils';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { appendArray } from '../utilities/array';
import { fileExists } from '../utilities/fileutils';
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

export function readFileIfExisting(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

function getIgnoredGlobs() {
  const ig = ignore();
  ig.add(readFileIfExisting(`${appRootPath}/.gitignore`));
  ig.add(readFileIfExisting(`${appRootPath}/.nxignore`));
  return ig;
}

export function calculateFileChanges(
  files: string[],
  allWorkspaceFiles: FileData[],
  nxArgs?: NxArgs,
  readFileAtRevision: (
    f: string,
    r: void | string
  ) => string = defaultReadFileAtRevision,
  ignore = getIgnoredGlobs()
): FileChange[] {
  files = files.filter((f) => !ignore.ignores(f));

  return files.map((f) => {
    const ext = extname(f);
    const file = allWorkspaceFiles.find((fileData) => fileData.file == f);
    const hash = file?.hash;

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

export function readEnvironment(): Environment {
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
