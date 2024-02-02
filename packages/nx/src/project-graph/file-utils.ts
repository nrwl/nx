import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import { readNxJson } from '../config/configuration';
import { FileData } from '../config/project-graph';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import type { NxArgs } from '../utils/command-line-utils';
import { workspaceRoot } from '../utils/workspace-root';
import { readJsonFile } from '../utils/fileutils';
import { jsonDiff } from '../utils/json-diff';
import {
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
} from './project-graph';
import { toOldFormat } from '../adapter/angular-json';
import { getIgnoreObject } from '../utils/ignore';
import { retrieveProjectConfigurationPaths } from './utils/retrieve-workspace-files';
import {
  mergeProjectConfigurationIntoRootMap,
  readProjectConfigurationsFromRootMap,
} from './utils/project-configuration-utils';
import { NxJsonConfiguration } from '../config/nx-json';
import { getDefaultPluginsSync } from '../utils/nx-plugin.deprecated';
import { minimatch } from 'minimatch';
import { CreateNodesResult } from '../devkit-exports';
import { PackageJsonProjectsNextToProjectJsonPlugin } from '../plugins/project-json/build-nodes/package-json-next-to-project-json';
import { LoadedNxPlugin } from '../utils/nx-plugin';

export interface Change {
  type: string;
}

export interface FileChange<T extends Change = Change> extends FileData {
  getChanges: () => T[];
}

export class WholeFileChange implements Change {
  type = 'WholeFileChange';
}

export class DeletedFileChange implements Change {
  type = 'WholeFileDeleted';
}

export function isWholeFileChange(change: Change): change is WholeFileChange {
  return change.type === 'WholeFileChange';
}

export function isDeletedFileChange(
  change: Change
): change is DeletedFileChange {
  return change.type === 'WholeFileDeleted';
}

export function calculateFileChanges(
  files: string[],
  allWorkspaceFiles: FileData[],
  nxArgs?: NxArgs,
  readFileAtRevision: (
    f: string,
    r: void | string
  ) => string = defaultReadFileAtRevision,
  ignore = getIgnoreObject() as ReturnType<typeof ignore>
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
        if (!existsSync(join(workspaceRoot, f))) {
          return [new DeletedFileChange()];
        }

        if (!nxArgs) {
          return [new WholeFileChange()];
        }

        if (nxArgs.files && nxArgs.files.includes(f)) {
          return [new WholeFileChange()];
        }
        switch (ext) {
          case '.json':
            try {
              const atBase = readFileAtRevision(f, nxArgs.base);
              const atHead = readFileAtRevision(f, nxArgs.head);
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
          stdio: ['pipe', 'pipe', 'ignore'],
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
}

/**
 * TODO(v19): Remove this function
 * @deprecated To get projects use {@link retrieveProjectConfigurations} instead
 */
export function readWorkspaceConfig(opts: {
  format: 'angularCli' | 'nx';
  path?: string;
}): ProjectsConfigurations {
  let configuration: ProjectsConfigurations | null = null;
  const root = opts.path || process.cwd();
  const nxJson = readNxJson(root);
  try {
    const projectGraph = readCachedProjectGraph();
    configuration = {
      ...nxJson,
      ...readProjectsConfigurationFromProjectGraph(projectGraph),
    };
  } catch {
    configuration = {
      version: 2,
      projects: getProjectsSyncNoInference(root, nxJson).projects,
    };
  }
  if (opts.format === 'angularCli') {
    return toOldFormat(configuration);
  } else {
    return configuration;
  }
}

export function defaultFileRead(filePath: string): string | null {
  return readFileSync(join(workspaceRoot, filePath), 'utf-8');
}

export function readPackageJson(): any {
  try {
    return readJsonFile(`${workspaceRoot}/package.json`);
  } catch {
    return {}; // if package.json doesn't exist
  }
}
// Original Exports
export { FileData };
// TODO(17): Remove these exports
export { readNxJson, workspaceLayout } from '../config/configuration';

/**
 * TODO(v19): Remove this function.
 */
function getProjectsSyncNoInference(root: string, nxJson: NxJsonConfiguration) {
  const projectFiles = retrieveProjectConfigurationPaths(
    root,
    getDefaultPluginsSync(root)
  );
  const plugins: LoadedNxPlugin[] = [
    { plugin: PackageJsonProjectsNextToProjectJsonPlugin },
    ...getDefaultPluginsSync(root),
  ];

  const projectRootMap: Map<string, ProjectConfiguration> = new Map();

  // We iterate over plugins first - this ensures that plugins specified first take precedence.
  for (const { plugin, options } of plugins) {
    const [pattern, createNodes] = plugin.createNodes ?? [];
    if (!pattern) {
      continue;
    }
    for (const file of projectFiles) {
      if (minimatch(file, pattern, { dot: true })) {
        let r = createNodes(file, options, {
          nxJsonConfiguration: nxJson,
          workspaceRoot: root,
        }) as CreateNodesResult;
        for (const node in r.projects) {
          const project = {
            root: node,
            ...r.projects[node],
          };
          mergeProjectConfigurationIntoRootMap(projectRootMap, project);
        }
      }
    }
  }

  return {
    projects: readProjectConfigurationsFromRootMap(projectRootMap),
  };
}
