import { performance } from 'perf_hooks';
import { getNxRequirePaths } from '../../utils/installation-directory';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import {
  NX_ANGULAR_JSON_PLUGIN_NAME,
  NxAngularJsonPlugin,
  shouldMergeAngularProjects,
} from '../../adapter/angular-json';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import type { NxWorkspaceFiles } from '../../native';
import { getNxPackageJsonWorkspacesPlugin } from '../../../plugins/package-json-workspaces';
import {
  ConfigurationSourceMaps,
  buildProjectsConfigurationsFromProjectPathsAndPlugins,
} from './project-configuration-utils';
import {
  getDefaultPlugins,
  LoadedNxPlugin,
  loadNxPlugins,
} from '../../utils/nx-plugin';
import { CreateProjectJsonProjectsPlugin } from '../../plugins/project-json/build-nodes/project-json';
import {
  getNxWorkspaceFilesFromContext,
  getProjectConfigurationsFromContext,
  globWithWorkspaceContext,
} from '../../utils/workspace-context';
import { buildAllWorkspaceFiles } from './build-all-workspace-files';

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
  performance.mark('native-file-deps:start');
  const plugins = await loadNxPlugins(
    nxJson?.plugins ?? [],
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );
  let globs = configurationGlobs(plugins);
  performance.mark('native-file-deps:end');
  performance.measure(
    'native-file-deps',
    'native-file-deps:start',
    'native-file-deps:end'
  );

  performance.mark('get-workspace-files:start');
  let projects: Record<string, ProjectConfiguration>;
  let externalNodes: Record<string, ProjectGraphExternalNode>;
  let sourceMaps: ConfigurationSourceMaps;

  const { projectFileMap, globalFiles, externalReferences } =
    (await getNxWorkspaceFilesFromContext(
      workspaceRoot,
      globs,
      async (configs: string[]) => {
        const projectConfigurations = await createProjectConfigurations(
          workspaceRoot,
          nxJson,
          configs,
          plugins
        );

      projects = projectConfigurations.projects;
      sourceMaps = projectConfigurations.sourceMaps;

      externalNodes = projectConfigurations.externalNodes;
      return projectConfigurations.rootMap;
    }
  )) as NxWorkspaceFiles;
  performance.mark('get-workspace-files:end');
  performance.measure(
    'get-workspace-files',
    'get-workspace-files:start',
    'get-workspace-files:end'
  );

  return {
    allWorkspaceFiles: buildAllWorkspaceFiles(projectFileMap, globalFiles),
    fileMap: {
      projectFileMap,
      nonProjectFiles: globalFiles,
    },
    projectConfigurations: {
      version: 2,
      projects,
    } as ProjectsConfigurations,
    externalNodes,
    sourceMaps,
    rustReferences: externalReferences,
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
  sourceMaps: ConfigurationSourceMaps;
}> {
  const plugins = await loadNxPlugins(
    nxJson?.plugins ?? [],
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  const globs = configurationGlobs(plugins);
  return _retrieveProjectConfigurations(workspaceRoot, nxJson, plugins, globs);
}

export async function retrieveProjectConfigurationsWithAngularProjects(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): Promise<{
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
  sourceMaps: ConfigurationSourceMaps;
}> {
  const plugins = await loadNxPlugins(
    nxJson?.plugins ?? [],
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  if (
    shouldMergeAngularProjects(workspaceRoot, true) &&
    !plugins.some((p) => p.plugin.name === NX_ANGULAR_JSON_PLUGIN_NAME)
  ) {
    plugins.push({ plugin: NxAngularJsonPlugin });
  }

  const globs = configurationGlobs(plugins);
  return _retrieveProjectConfigurations(workspaceRoot, nxJson, plugins, globs);
}

function _retrieveProjectConfigurations(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration,
  plugins: LoadedNxPlugin[],
  globs: string[]
): Promise<{
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
  sourceMaps: ConfigurationSourceMaps;
}> {
  let result: {
    externalNodes: Record<string, ProjectGraphExternalNode>;
    projectNodes: Record<string, ProjectConfiguration>;
    sourceMaps: ConfigurationSourceMaps;
  };
  return getProjectConfigurationsFromContext(
    workspaceRoot,
    globs,
    async (configs: string[]) => {
      const { projects, externalNodes, rootMap, sourceMaps } =
        await createProjectConfigurations(
          workspaceRoot,
          nxJson,
          configs,
          plugins
        );

      result = {
        projectNodes: projects,
        externalNodes: externalNodes,
        sourceMaps,
      };

      return rootMap;
    }
  ).then(() => result);
}

export function retrieveProjectConfigurationPaths(
  root: string,
  plugins: LoadedNxPlugin[]
): string[] {
  const projectGlobPatterns = configurationGlobs(plugins);
  return globWithWorkspaceContext(root, projectGlobPatterns);
}

const projectsWithoutPluginCache = new Map<
  string,
  Record<string, ProjectConfiguration>
>();

// TODO: This function is called way too often, it should be optimized without this cache
export async function retrieveProjectConfigurationsWithoutPluginInference(
  root: string
): Promise<Record<string, ProjectConfiguration>> {
  const nxJson = readNxJson(root);
  const plugins = await getDefaultPlugins(root);
  const projectGlobPatterns = retrieveProjectConfigurationPaths(root, plugins);
  const cacheKey = root + ',' + projectGlobPatterns.join(',');

  if (projectsWithoutPluginCache.has(cacheKey)) {
    return projectsWithoutPluginCache.get(cacheKey);
  }

  let projects: Record<string, ProjectConfiguration>;
  await getProjectConfigurationsFromContext(
    root,
    projectGlobPatterns,
    async (configs: string[]) => {
      const projectConfigurations = await createProjectConfigurations(
        root,
        nxJson,
        configs,
        [
          { plugin: getNxPackageJsonWorkspacesPlugin(root) },
          { plugin: CreateProjectJsonProjectsPlugin },
        ]
      );
      projects = projectConfigurations.projects;
      return projectConfigurations.rootMap;
    }
  );

  projectsWithoutPluginCache.set(cacheKey, projects);

  return projects;
}

export async function createProjectConfigurations(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration,
  configFiles: string[],
  plugins: LoadedNxPlugin[]
): Promise<{
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
  rootMap: Record<string, string>;
  sourceMaps: ConfigurationSourceMaps;
}> {
  performance.mark('build-project-configs:start');

  const { projects, externalNodes, rootMap, sourceMaps } =
    await buildProjectsConfigurationsFromProjectPathsAndPlugins(
      nxJson,
      configFiles,
      plugins,
      workspaceRoot
    );

  performance.mark('build-project-configs:end');
  performance.measure(
    'build-project-configs',
    'build-project-configs:start',
    'build-project-configs:end'
  );

  return {
    projects,
    externalNodes,
    rootMap,
    sourceMaps,
  };
}

export function configurationGlobs(plugins: LoadedNxPlugin[]): string[] {
  const globPatterns = [];
  for (const { plugin } of plugins) {
    if (plugin.createNodes) {
      globPatterns.push(plugin.createNodes[0]);
    }
  }
  return globPatterns;
}
