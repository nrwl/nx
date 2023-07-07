import { performance } from 'perf_hooks';
import {
  buildProjectsConfigurationsFromProjectPaths,
  getGlobPatternsFromPackageManagerWorkspaces,
  getGlobPatternsFromPluginsAsync,
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '../../config/workspaces';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { readJsonFile } from '../../utils/fileutils';
import { join } from 'path';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import {
  mergeAngularJsonAndProjects,
  shouldMergeAngularProjects,
} from '../../adapter/angular-json';
import { NxJsonConfiguration } from '../../config/nx-json';
import { FileData, ProjectFileMap } from '../../config/project-graph';
import type { NxWorkspaceFiles } from '../../native';

/**
 * Walks the workspace directory to create the `projectFileMap`, `ProjectConfigurations` and `allWorkspaceFiles`
 * @throws
 * @param workspaceRoot
 * @param nxJson
 */
export async function retrieveWorkspaceFiles(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
) {
  const { getWorkspaceFilesNative } = require('../../native');

  performance.mark('native-file-deps:start');
  let globs = await configurationGlobs(workspaceRoot, nxJson);
  performance.mark('native-file-deps:end');
  performance.measure(
    'native-file-deps',
    'native-file-deps:start',
    'native-file-deps:end'
  );

  performance.mark('get-workspace-files:start');

  const { projectConfigurations, projectFileMap, globalFiles } =
    getWorkspaceFilesNative(
      workspaceRoot,
      globs,
      (configs: string[]): Record<string, ProjectConfiguration> => {
        const projectConfigurations = createProjectConfigurations(
          workspaceRoot,
          nxJson,
          configs
        );

        return projectConfigurations.projects;
      }
    ) as NxWorkspaceFiles;
  performance.mark('get-workspace-files:end');
  performance.measure(
    'get-workspace-files',
    'get-workspace-files:start',
    'get-workspace-files:end'
  );

  return {
    allWorkspaceFiles: buildAllWorkspaceFiles(projectFileMap, globalFiles),
    projectFileMap,
    projectConfigurations: {
      version: 2,
      projects: projectConfigurations,
    } as ProjectsConfigurations,
  };
}

/**
 * Walk through the workspace and return `ProjectConfigurations`. Only use this if the projectFileMap is not needed.
 *
 * @param workspaceRoot
 * @param nxJson
 */
export async function retrieveProjectConfigurations(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
) {
  const { getProjectConfigurations } = require('../../native');
  const globs = await configurationGlobs(workspaceRoot, nxJson);
  return getProjectConfigurations(
    workspaceRoot,
    globs,
    (configs: string[]): Record<string, ProjectConfiguration> => {
      const projectConfigurations = createProjectConfigurations(
        workspaceRoot,
        nxJson,
        configs
      );

      return projectConfigurations.projects;
    }
  );
}

function buildAllWorkspaceFiles(
  projectFileMap: ProjectFileMap,
  globalFiles: FileData[]
): FileData[] {
  performance.mark('get-all-workspace-files:start');
  let fileData = Object.values(projectFileMap).flat();

  fileData = fileData.concat(globalFiles);
  performance.mark('get-all-workspace-files:end');
  performance.measure(
    'get-all-workspace-files',
    'get-all-workspace-files:start',
    'get-all-workspace-files:end'
  );

  return fileData;
}

function createProjectConfigurations(
  workspaceRoot: string,
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
    projectConfigurations = mergeAngularJsonAndProjects(
      projectConfigurations,
      workspaceRoot
    );
  }
  performance.mark('build-project-configs:end');
  performance.measure(
    'build-project-configs',
    'build-project-configs:start',
    'build-project-configs:end'
  );

  return {
    version: 2,
    projects: projectConfigurations,
  };
}

function mergeTargetDefaultsIntoProjectDescriptions(
  projects: Record<string, ProjectConfiguration>,
  nxJson: NxJsonConfiguration
) {
  for (const proj of Object.values(projects)) {
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
  return projects;
}

async function configurationGlobs(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  let pluginGlobs = await getGlobPatternsFromPluginsAsync(
    nxJson,
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  return [
    'project.json',
    '**/project.json',
    ...pluginGlobs,
    ...getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot),
  ];
}
