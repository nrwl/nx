import { performance } from 'perf_hooks';
import { getNxRequirePaths } from '../../utils/installation-directory';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import {
  NxAngularJsonPlugin,
  NX_ANGULAR_JSON_PLUGIN_NAME,
  shouldMergeAngularProjects,
} from '../../adapter/angular-json';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  FileData,
  ProjectFileMap,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import type { NxWorkspaceFiles } from '../../native';
import {
  getGlobPatternsFromPackageManagerWorkspaces,
  getNxPackageJsonWorkspacesPlugin,
} from '../../../plugins/package-json-workspaces';
import { buildProjectsConfigurationsFromProjectPathsAndPlugins } from './project-configuration-utils';
import {
  LoadedNxPlugin,
  loadNxPlugins,
  loadNxPluginsSync,
  NxPluginV2,
  unregisterPluginTSTranspiler,
} from '../../utils/nx-plugin';
import { CreateProjectJsonProjectsPlugin } from '../../plugins/project-json/build-nodes/project-json';
import {
  globWithWorkspaceContext,
  getProjectConfigurationsFromContext,
  getNxWorkspaceFilesFromContext,
} from '../../utils/workspace-context';

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
  let globs = configurationGlobs(workspaceRoot, plugins);
  performance.mark('native-file-deps:end');
  performance.measure(
    'native-file-deps',
    'native-file-deps:start',
    'native-file-deps:end'
  );

  performance.mark('get-workspace-files:start');

  const { projectConfigurations, projectFileMap, globalFiles, externalNodes } =
    getNxWorkspaceFilesFromContext(
      workspaceRoot,
      globs,
      (configs: string[]) => {
        const projectConfigurations = createProjectConfigurations(
          workspaceRoot,
          nxJson,
          configs,
          plugins
        );

        return {
          projectNodes: projectConfigurations.projects,
          externalNodes: projectConfigurations.externalNodes,
        };
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
    fileMap: {
      projectFileMap,
      nonProjectFiles: globalFiles,
    },
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
  const plugins = await loadNxPlugins(
    nxJson?.plugins ?? [],
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  const globs = configurationGlobs(workspaceRoot, plugins);
  return _retrieveProjectConfigurations(workspaceRoot, nxJson, plugins, globs);
}

export async function retrieveProjectConfigurationsWithAngularProjects(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): Promise<{
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
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

  const globs = configurationGlobs(workspaceRoot, plugins);
  return _retrieveProjectConfigurations(workspaceRoot, nxJson, plugins, globs);
}

/**
 * @deprecated Use {@link retrieveProjectConfigurations} instead.
 */
export function retrieveProjectConfigurationsSync(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration
): {
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
} {
  const plugins = loadNxPluginsSync(
    nxJson?.plugins ?? [],
    getNxRequirePaths(workspaceRoot),
    workspaceRoot
  );

  const globs = configurationGlobs(workspaceRoot, plugins);
  return _retrieveProjectConfigurations(workspaceRoot, nxJson, plugins, globs);
}

function _retrieveProjectConfigurations(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration,
  plugins: LoadedNxPlugin[],
  globs: string[]
): {
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectNodes: Record<string, ProjectConfiguration>;
} {
  return getProjectConfigurationsFromContext(
    workspaceRoot,
    globs,
    (configs: string[]) => {
      const projectConfigurations = createProjectConfigurations(
        workspaceRoot,
        nxJson,
        configs,
        plugins
      );

      return {
        projectNodes: projectConfigurations.projects,
        externalNodes: projectConfigurations.externalNodes,
      };
    }
  ) as {
    externalNodes: Record<string, ProjectGraphExternalNode>;
    projectNodes: Record<string, ProjectConfiguration>;
  };
}

export async function retrieveProjectConfigurationPaths(
  root: string,
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  const projectGlobPatterns = configurationGlobs(
    root,
    await loadNxPlugins(nxJson?.plugins ?? [], getNxRequirePaths(root), root)
  );
  return globWithWorkspaceContext(root, projectGlobPatterns);
}

export function retrieveProjectConfigurationPathsWithoutPluginInference(
  root: string
): string[] {
  return globWithWorkspaceContext(root, configurationGlobsWithoutPlugins(root));
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

  const projectConfigurations = getProjectConfigurationsFromContext(
    root,
    projectGlobPatterns,
    (configs: string[]) => {
      const { projects } = createProjectConfigurations(root, nxJson, configs, [
        { plugin: getNxPackageJsonWorkspacesPlugin(root) },
        { plugin: CreateProjectJsonProjectsPlugin },
      ]);
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
  let fileData: FileData[] = Object.values(projectFileMap).flat();
  fileData = fileData
    .concat(globalFiles)
    .sort((a, b) => a.file.localeCompare(b.file));
  performance.mark('get-all-workspace-files:end');
  performance.measure(
    'get-all-workspace-files',
    'get-all-workspace-files:start',
    'get-all-workspace-files:end'
  );

  return fileData;
}

export function createProjectConfigurations(
  workspaceRoot: string,
  nxJson: NxJsonConfiguration,
  configFiles: string[],
  plugins: LoadedNxPlugin[]
): {
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
} {
  performance.mark('build-project-configs:start');

  const { projects, externalNodes } =
    buildProjectsConfigurationsFromProjectPathsAndPlugins(
      nxJson,
      configFiles,
      plugins,
      workspaceRoot
    );

  let projectConfigurations = projects;

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

export function configurationGlobs(
  workspaceRoot: string,
  plugins: LoadedNxPlugin[]
): string[] {
  const globPatterns: string[] =
    configurationGlobsWithoutPlugins(workspaceRoot);
  for (const { plugin } of plugins) {
    if (plugin.createNodes) {
      globPatterns.push(plugin.createNodes[0]);
    }
  }
  return globPatterns;
}

function configurationGlobsWithoutPlugins(workspaceRoot: string): string[] {
  return [
    'project.json',
    '**/project.json',
    ...getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot),
  ];
}
