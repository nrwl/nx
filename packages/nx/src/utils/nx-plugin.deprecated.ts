import { getNxPackageJsonWorkspacesPlugin } from '../../plugins/package-json-workspaces';
import {
  NxAngularJsonPlugin,
  shouldMergeAngularProjects,
} from '../adapter/angular-json';
import { NxJsonConfiguration, PluginConfiguration } from '../config/nx-json';
import { ProjectGraphProcessor } from '../config/project-graph';
import { TargetConfiguration } from '../config/workspace-json-project-json';
import { CreateProjectJsonProjectsPlugin } from '../plugins/project-json/build-nodes/project-json';
import { getNxRequirePaths } from './installation-directory';
import {
  ensurePluginIsV2,
  getPluginPathAndName,
  LoadedNxPlugin,
  nxPluginCache,
  NxPluginV2,
} from './nx-plugin';
import { workspaceRoot } from './workspace-root';

/**
 * @deprecated Add targets to the projects in a {@link CreateNodes} function instead. This will be removed in Nx 18
 */
export type ProjectTargetConfigurator = (
  file: string
) => Record<string, TargetConfiguration>;

/**
 * @deprecated Use {@link NxPluginV2} instead. This will be removed in Nx 18
 */
export type NxPluginV1 = {
  name: string;
  /**
   * @deprecated Use {@link CreateNodes} and {@link CreateDependencies} instead. This will be removed in Nx 18
   */
  processProjectGraph?: ProjectGraphProcessor;

  /**
   * @deprecated Add targets to the projects inside of {@link CreateNodes} instead. This will be removed in Nx 18
   */
  registerProjectTargets?: ProjectTargetConfigurator;

  /**
   * A glob pattern to search for non-standard project files.
   * @example: ["*.csproj", "pom.xml"]
   * @deprecated Use {@link CreateNodes} instead. This will be removed in Nx 18
   */
  projectFilePatterns?: string[];
};

function loadNxPluginSync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string
): LoadedNxPlugin {
  const { plugin: moduleName, options } =
    typeof pluginConfiguration === 'object'
      ? pluginConfiguration
      : { plugin: pluginConfiguration, options: undefined };
  let pluginModule = nxPluginCache.get(moduleName);
  if (pluginModule) {
    return { plugin: pluginModule, options };
  }

  let { pluginPath, name } = getPluginPathAndName(moduleName, paths, root);
  const plugin = ensurePluginIsV2(
    require(pluginPath)
  ) as LoadedNxPlugin['plugin'];
  plugin.name ??= name;
  nxPluginCache.set(moduleName, plugin);
  return { plugin, options };
}

/**
 * @deprecated Use loadNxPlugins instead.
 */
export function loadNxPluginsSync(
  plugins: NxJsonConfiguration['plugins'],
  paths = getNxRequirePaths(),
  root = workspaceRoot
): LoadedNxPlugin[] {
  // TODO: This should be specified in nx.json
  // Temporarily load js as if it were a plugin which is built into nx
  // In the future, this will be optional and need to be specified in nx.json
  const result: LoadedNxPlugin[] = [...getDefaultPluginsSync(root)];

  if (shouldMergeAngularProjects(root, false)) {
    result.push({ plugin: NxAngularJsonPlugin, options: undefined });
  }

  plugins ??= [];
  for (const plugin of plugins) {
    try {
      result.push(loadNxPluginSync(plugin, paths, root));
    } catch (e) {
      if (e.code === 'ERR_REQUIRE_ESM') {
        throw new Error(
          `Unable to load "${plugin}". Plugins cannot be ESM modules. They must be CommonJS modules. Follow the issue on github: https://github.com/nrwl/nx/issues/15682`
        );
      }
      throw e;
    }
  }

  // We push the nx core node plugins onto the end, s.t. it overwrites any other plugins
  result.push(
    { plugin: getNxPackageJsonWorkspacesPlugin(root) },
    { plugin: CreateProjectJsonProjectsPlugin }
  );

  return result;
}

function getDefaultPluginsSync(root: string): LoadedNxPlugin[] {
  const plugins: NxPluginV2[] = [require('../plugins/js')];

  if (shouldMergeAngularProjects(root, false)) {
    plugins.push(require('../adapter/angular-json').NxAngularJsonPlugin);
  }
  return plugins.map((p) => ({
    plugin: p,
  }));
}
