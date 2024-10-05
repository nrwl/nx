import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, join, relative, sep } from 'path';
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
import {
  mergeProjectConfigurationIntoRootMap,
  readProjectConfigurationsFromRootMap,
} from './utils/project-configuration-utils';
import {
  buildProjectConfigurationFromPackageJson,
  getGlobPatternsFromPackageManagerWorkspaces,
} from '../plugins/package-json';
import { globWithWorkspaceContextSync } from '../utils/workspace-context';
import { buildProjectFromProjectJson } from '../plugins/project-json/build-nodes/project-json';
import { PackageJson } from '../utils/package-json';
import { NxJsonConfiguration } from '../config/nx-json';

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
          windowsHide: true,
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
}

/**
 * TODO(v21): Remove this function
 * @deprecated To get projects use {@link retrieveProjectConfigurations} instead. This will be removed in v21.
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
      projects: getProjectsSync(root, nxJson),
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

/**
 * TODO(v21): Remove this function.
 */
function getProjectsSync(
  root: string,
  nxJson: NxJsonConfiguration
): {
  [name: string]: ProjectConfiguration;
} {
  /**
   * We can't update projects that come from plugins anyways, so we are going
   * to ignore them for now. Plugins should add their own add/create/update methods
   * if they would like to use devkit to update inferred projects.
   */
  const patterns = [
    '**/project.json',
    'project.json',
    ...getGlobPatternsFromPackageManagerWorkspaces(root, readJsonFile),
  ];
  const projectFiles = globWithWorkspaceContextSync(root, patterns);

  const rootMap: Record<string, ProjectConfiguration> = {};
  for (const projectFile of projectFiles) {
    if (basename(projectFile) === 'project.json') {
      const json = readJsonFile(projectFile);
      const config = buildProjectFromProjectJson(json, projectFile);
      mergeProjectConfigurationIntoRootMap(
        rootMap,
        config,
        undefined,
        undefined,
        true
      );
    } else if (basename(projectFile) === 'package.json') {
      const packageJson = readJsonFile<PackageJson>(projectFile);
      const config = buildProjectConfigurationFromPackageJson(
        packageJson,
        root,
        projectFile,
        nxJson
      );
      if (!rootMap[config.root]) {
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          // Inferred targets, tags, etc don't show up when running generators
          // This is to help avoid running into issues when trying to update the workspace
          {
            name: config.name,
            root: config.root,
          },
          undefined,
          undefined,
          true
        );
      }
    }
  }

  return readProjectConfigurationsFromRootMap(rootMap);
}
