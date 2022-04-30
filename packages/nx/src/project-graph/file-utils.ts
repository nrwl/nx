import { toOldFormatOrNull, Workspaces } from '../config/workspaces';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import type { NxArgs } from '../utils/command-line-utils';
import { workspaceRoot } from '../utils/app-root';
import { fileExists } from '../utils/fileutils';
import { jsonDiff } from '../utils/json-diff';
import ignore from 'ignore';
import { FileData } from '../config/project-graph';
import { readJsonFile } from '../utils/fileutils';
import { NxJsonConfiguration } from '../config/nx-json';
import { WorkspaceJsonConfiguration } from '../config/workspace-json-project-json';

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
  ig.add(readFileIfExisting(`${workspaceRoot}/.gitignore`));
  ig.add(readFileIfExisting(`${workspaceRoot}/.nxignore`));
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
    const fileFullPath = `${workspaceRoot}${sep}${file}`;
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
    path: workspaceRoot,
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
  if (fileExists(`${workspaceRoot}/angular.json`)) {
    return 'angular.json';
  } else {
    return 'workspace.json';
  }
}

export function defaultFileRead(filePath: string): string | null {
  return readFileSync(join(workspaceRoot, filePath), 'utf-8');
}

export function readPackageJson(): any {
  return readJsonFile(`${workspaceRoot}/package.json`);
}

/**
 * Returns the contents of nx.json.
 *
 * If nx.json extends another config file, it will be inlined here.
 */
export function readNxJson(
  path: string = `${workspaceRoot}/nx.json`
): NxJsonConfiguration {
  let config = readJsonFile<NxJsonConfiguration>(path);

  if (config.extends) {
    config = {
      ...resolveNxJsonExtends(config.extends),
      ...config,
    };
  }

  return config;
}

function resolveNxJsonExtends(extendedNxJsonPath: string) {
  try {
    return readJsonFile(require.resolve(extendedNxJsonPath));
  } catch (e) {
    throw new Error(`Unable to resolve nx.json extends. Error: ${e.message}`);
  }
}

/**
 * Returns information about where apps and libs will be created.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxJson = readNxJson();
  return {
    appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
  };
}

// Original Exports
export { FileData };
