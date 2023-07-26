import { performance } from 'perf_hooks';
import {
  buildProjectsConfigurationsFromProjectPaths,
  getGlobPatternsFromPackageManagerWorkspaces,
  getGlobPatternsFromPlugins,
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
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  FileData,
  ProjectFileMap,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
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
  const { getWorkspaceFilesNative } =
    require('../../native') as typeof import('../../native');

  performance.mark('native-file-deps:start');
  let globs = await configurationGlobs(workspaceRoot, nxJson);
  performance.mark('native-file-deps:end');
  performance.measure(
    'native-file-deps',
    'native-file-deps:start',
    'native-file-deps:end'
  );

  performance.mark('get-workspace-files:start');

  const { projectConfigurations, projectFileMap, globalFiles, externalNodes } =
    getWorkspaceFilesNative(workspaceRoot, globs, (configs: string[]) => {
      const projectConfigurations = createProjectConfigurations(
        workspaceRoot,
        nxJson,
        configs
      );

      return {
        projectNodes: projectConfigurations.projects,
        externalNodes: projectConfigurations.externalNodes,
      };
    }) as NxWorkspaceFiles;
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
    externalNodes: externalNodes as Record<string, ProjectGraphExternalNode>,
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
): Promise<{
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
}> {
  const { getProjectConfigurations } =
    require('../../native') as typeof import('../../native');
  const globs = await configurationGlobs(workspaceRoot, nxJson);
  return getProjectConfigurations(workspaceRoot, globs, (configs: string[]) => {
    const projectConfigurations = createProjectConfigurations(
      workspaceRoot,
      nxJson,
      configs
    );

    return {
      projectNodes: projectConfigurations.projects,
      externalNodes: projectConfigurations.externalNodes,
    };
  }) as {
    externalNodes: Record<string, ProjectGraphExternalNode>;
    projectNodes: Record<string, ProjectConfiguration>;
  };
}

export function retrieveProjectConfigurationPaths(
  root: string,
  nxJson: NxJsonConfiguration
): string[] {
  const projectGlobPatterns = configurationGlobsSync(root, nxJson);
  const { getProjectConfigurationFiles } =
    require('../../native') as typeof import('../../native');
  return getProjectConfigurationFiles(root, projectGlobPatterns);
}

const projectsWithoutPluginCache = new Map<
  string,
  Record<string, ProjectConfiguration>
>();

// TODO: This function is called way too often, it should be optimized without this cache
export function retrieveProjectConfigurationsWithoutPluginInference(
  root: string
): Record<string, ProjectConfiguration> {
  const nxJson = readNxJson(root);
  const projectGlobPatterns = configurationGlobsWithoutPlugins(root);
  const cacheKey = root + ',' + projectGlobPatterns.join(',');

  if (projectsWithoutPluginCache.has(cacheKey)) {
    return projectsWithoutPluginCache.get(cacheKey);
  }

  const { getProjectConfigurations } =
    require('../../native') as typeof import('../../native');
  const projectConfigurations = getProjectConfigurations(
    root,
    projectGlobPatterns,
    (configs: string[]) => {
      const { projects } = createProjectConfigurations(root, nxJson, configs);
      return {
        projectNodes: projects,
        externalNodes: {},
      };
    }
  ).projectNodes as Record<string, ProjectConfiguration>;

  projectsWithoutPluginCache.set(cacheKey, projectConfigurations);

  return projectConfigurations;
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
): {
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
} {
  performance.mark('build-project-configs:start');

  const { projects, externalNodes } =
    buildProjectsConfigurationsFromProjectPaths(
      nxJson,
      configFiles,
      workspaceRoot,
      (path) => readJsonFile(join(workspaceRoot, path))
    );

  let projectConfigurations = mergeTargetDefaultsIntoProjectDescriptions(
    projects,
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
    projects: projectConfigurations,
    externalNodes,
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

  return [...configurationGlobsWithoutPlugins(workspaceRoot), ...pluginGlobs];
}

/**
 * @deprecated Use {@link configurationGlobs} instead.
 */
function configurationGlobsSync(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): string[] {
  let pluginGlobs = getGlobPatternsFromPlugins(
    nxJson,
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  return [...configurationGlobsWithoutPlugins(workspaceRoot), ...pluginGlobs];
}

function configurationGlobsWithoutPlugins(workspaceRoot: string): string[] {
  return [
    'project.json',
    '**/project.json',
    ...getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot),
  ];
}
