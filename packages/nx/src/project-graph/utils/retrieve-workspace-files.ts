import { performance } from 'perf_hooks';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import {
  NX_ANGULAR_JSON_PLUGIN_NAME,
  shouldMergeAngularProjects,
} from '../../adapter/angular-json';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  ConfigurationResult,
  createProjectConfigurationsWithPlugins,
} from './project-configuration-utils';
import type { LoadedNxPlugin } from '../plugins/loaded-nx-plugin';
import {
  getNxWorkspaceFilesFromContext,
  globWithWorkspaceContext,
  multiGlobWithWorkspaceContext,
} from '../../utils/workspace-context';
import { buildAllWorkspaceFiles } from './build-all-workspace-files';
import { join } from 'path';
import {
  getOnlyDefaultPlugins,
  getPluginsSeparated,
  SeparatedPlugins,
} from '../plugins/get-plugins';

/**
 * Walks the workspace directory to create the `projectFileMap`, `ProjectConfigurations` and `allWorkspaceFiles`
 * @throws
 * @param workspaceRoot
 * @param nxJson
 */
export async function retrieveWorkspaceFiles(
  workspaceRoot: string,
  projectRootMap: Record<string, string>
) {
  performance.mark('native-file-deps:start');
  performance.mark('native-file-deps:end');
  performance.measure(
    'native-file-deps',
    'native-file-deps:start',
    'native-file-deps:end'
  );

  performance.mark('get-workspace-files:start');

  const { projectFileMap, globalFiles, externalReferences } =
    await getNxWorkspaceFilesFromContext(workspaceRoot, projectRootMap);
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
    rustReferences: externalReferences,
  };
}

/**
 * Walk through the workspace and return `ProjectConfigurations`. Only use this if the projectFileMap is not needed.
 *
 * Accepts separated plugin sets so that target defaults can be applied
 * between specified and default plugin processing phases.
 */
export async function retrieveProjectConfigurations(
  separatedPlugins: SeparatedPlugins,
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): Promise<ConfigurationResult> {
  const specifiedWithCreateNodes = separatedPlugins.specifiedPlugins.filter(
    (p) => !!p.createNodes
  );
  const defaultWithCreateNodes = separatedPlugins.defaultPlugins.filter(
    (p) => !!p.createNodes
  );

  const specifiedGlobPatterns = getGlobPatternsOfPlugins(
    specifiedWithCreateNodes
  );
  const defaultGlobPatterns = getGlobPatternsOfPlugins(defaultWithCreateNodes);

  const [specifiedPluginFiles, defaultPluginFiles] = await Promise.all([
    multiGlobWithWorkspaceContext(workspaceRoot, specifiedGlobPatterns),
    multiGlobWithWorkspaceContext(workspaceRoot, defaultGlobPatterns),
  ]);

  return createProjectConfigurationsWithPlugins(
    workspaceRoot,
    nxJson,
    {
      specifiedPluginFiles: specifiedPluginFiles ?? [],
      defaultPluginFiles: defaultPluginFiles ?? [],
    },
    {
      specifiedPlugins: specifiedWithCreateNodes,
      defaultPlugins: defaultWithCreateNodes,
    }
  );
}

export async function retrieveProjectConfigurationsWithAngularProjects(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): Promise<ConfigurationResult> {
  const pluginsToLoad = nxJson?.plugins ?? [];

  if (
    shouldMergeAngularProjects(workspaceRoot, true) &&
    !pluginsToLoad.some(
      (p) =>
        p === NX_ANGULAR_JSON_PLUGIN_NAME ||
        (typeof p === 'object' && p.plugin === NX_ANGULAR_JSON_PLUGIN_NAME)
    )
  ) {
    pluginsToLoad.push(join(__dirname, '../../adapter/angular-json'));
  }

  const separatedPlugins = await getPluginsSeparated(workspaceRoot);

  const res = await retrieveProjectConfigurations(
    separatedPlugins,
    workspaceRoot,
    nxJson
  );
  return res;
}

export async function retrieveProjectConfigurationPaths(
  root: string,
  plugins: Array<LoadedNxPlugin>
): Promise<string[]> {
  const projectGlobPatterns = getGlobPatternsOfPlugins(plugins);
  const pluginConfigFiles = await multiGlobWithWorkspaceContext(
    root,
    projectGlobPatterns
  );
  return pluginConfigFiles.flat();
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
  const defaultPlugins = await getOnlyDefaultPlugins(); // only load default plugins
  const pluginsWithCreateNodes = defaultPlugins.filter((p) => !!p.createNodes);
  const projectGlobPatterns = getGlobPatternsOfPlugins(pluginsWithCreateNodes);
  const cacheKey = root + ',' + projectGlobPatterns.join(',');

  if (projectsWithoutPluginCache.has(cacheKey)) {
    return projectsWithoutPluginCache.get(cacheKey);
  }

  const projectFiles =
    (await multiGlobWithWorkspaceContext(root, projectGlobPatterns)) ?? [];
  const { projects } = await createProjectConfigurationsWithPlugins(
    root,
    nxJson,
    {
      specifiedPluginFiles: [],
      defaultPluginFiles: projectFiles,
    },
    {
      specifiedPlugins: [],
      defaultPlugins: pluginsWithCreateNodes,
    }
  );

  projectsWithoutPluginCache.set(cacheKey, projects);

  return projects;
}

export function getGlobPatternsOfPlugins(
  plugins: Array<LoadedNxPlugin>
): string[] {
  return plugins.map((p) => p.createNodes[0]);
}
