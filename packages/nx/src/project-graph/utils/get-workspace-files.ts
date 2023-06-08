import { performance } from 'perf_hooks';
import {
  buildProjectsConfigurationsFromProjectPaths,
  getGlobPatternsFromPackageManagerWorkspaces,
  getGlobPatternsFromPluginsAsync,
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
  Workspaces,
} from '../../config/workspaces';
import { workspaceRoot } from '../../utils/workspace-root';
import { getNxRequirePaths } from '../../utils/installation-directory';
import type { NxWorkspaceFiles } from '../../native';
import { readJsonFile } from '../../utils/fileutils';
import { join } from 'path';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import {
  mergeAngularJsonAndProjects,
  shouldMergeAngularProjects,
} from '../../adapter/angular-json';
import { NxJsonConfiguration } from '../../config/nx-json';
import { FileData, ProjectFileMap } from '../../config/project-graph';

let workspaceFilesCache: NxWorkspaceFiles | undefined = undefined;

export async function getWorkspaceFiles(
  nxJson: NxJsonConfiguration,
  skipCache: boolean = false
) {
  if (workspaceFilesCache && !skipCache) {
    return workspaceFilesCache;
  }

  const { getWorkspaceFilesNative } = require('../../native');

  performance.mark('native-file-deps:start');
  let pluginGlobs = await getGlobPatternsFromPluginsAsync(
    nxJson,
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  let globs = [
    'project.json',
    '**/project.json',
    ...pluginGlobs,
    ...getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot),
  ];
  performance.mark('native-file-deps:end');
  performance.measure(
    'native-file-deps',
    'native-file-deps:start',
    'native-file-deps:end'
  );

  performance.mark('get-workspace-files:start');
  let workspaceFiles = getWorkspaceFilesNative(workspaceRoot, globs);
  performance.mark('get-workspace-files:end');
  performance.measure(
    'get-workspace-files',
    'get-workspace-files:start',
    'get-workspace-files:end'
  );

  workspaceFilesCache = workspaceFiles;

  return workspaceFilesCache;
}

export function getAllWorkspaceFiles(
  projectFileMap: ProjectFileMap,
  globalFiles: FileData[]
): FileData[] {
  performance.mark('get-all-workspace-files:start');
  let fileData = Object.values(projectFileMap).flat();

  fileData.push(...globalFiles);
  performance.mark('get-all-workspace-files:end');
  performance.measure(
    'get-all-workspace-files',
    'get-all-workspace-files:start',
    'get-all-workspace-files:end'
  );

  return fileData;
}

export function createProjectConfigurations(
  nxJson: NxJsonConfiguration,
  configFiles: string[]
): ProjectsConfigurations {
  performance.mark('build-project-configs:start');

  let projectConfigurations = mergeTargetDefaultsIntoProjectDescriptions(
    buildProjectsConfigurationsFromProjectPaths(nxJson, configFiles, (path) =>
      readJsonFile(join(workspaceRoot, path))
    ),
    nxJson
  );

  if (shouldMergeAngularProjects(workspaceRoot, false)) {
    projectConfigurations.projects = mergeAngularJsonAndProjects(
      projectConfigurations.projects,
      workspaceRoot
    );
  }
  performance.mark('build-project-configs:end');
  performance.measure(
    'build-project-configs',
    'build-project-configs:start',
    'build-project-configs:end'
  );

  return projectConfigurations;
}

function mergeTargetDefaultsIntoProjectDescriptions(
  config: ProjectsConfigurations,
  nxJson: NxJsonConfiguration
) {
  for (const proj of Object.values(config.projects)) {
    if (proj.targets) {
      for (const targetName of Object.keys(proj.targets)) {
        const projectTargetDefinition = proj.targets[targetName];
        const defaults = readTargetDefaultsForTarget(
          targetName,
          nxJson.targetDefaults,
          projectTargetDefinition.executor
        );

        if (defaults) {
          proj.targets[targetName] = mergeTargetConfigurations(
            proj,
            targetName,
            defaults
          );
        }
      }
    }
  }
  return config;
}
