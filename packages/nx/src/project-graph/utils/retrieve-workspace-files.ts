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
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import {
  mergeAngularJsonAndProjects,
  shouldMergeAngularProjects,
} from '../../adapter/angular-json';
import { NxJsonConfiguration } from '../../config/nx-json';
import { FileData, ProjectFileMap } from '../../config/project-graph';
import { NxWorkspaceFiles, WorkspaceErrors } from '../../native';

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
  let workspaceFiles: NxWorkspaceFiles;
  try {
    workspaceFiles = getWorkspaceFilesNative(workspaceRoot, globs);
  } catch (e) {
    // If the error is a parse error from Rust, then use the JS readJsonFile function to write a pretty error message
    if (e.code === WorkspaceErrors.ParseError) {
      readJsonFile(join(workspaceRoot, e.message));
      // readJsonFile should always fail, but if it doesn't, then throw the original error
      throw e;
    } else {
      throw e;
    }
  }
  performance.mark('get-workspace-files:end');
  performance.measure(
    'get-workspace-files',
    'get-workspace-files:start',
    'get-workspace-files:end'
  );

  return {
    allWorkspaceFiles: buildAllWorkspaceFiles(
      workspaceFiles.projectFileMap,
      workspaceFiles.globalFiles
    ),
    projectFileMap: workspaceFiles.projectFileMap,
    projectConfigurations: createProjectConfigurations(
      workspaceRoot,
      nxJson,
      workspaceFiles.configFiles
    ),
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
  const { getConfigFiles } = require('../../native');
  const globs = await configurationGlobs(workspaceRoot, nxJson);
  const configPaths = getConfigFiles(workspaceRoot, globs);
  return createProjectConfigurations(workspaceRoot, nxJson, configPaths);
}

function buildAllWorkspaceFiles(
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
