import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from 'nx/src/project-graph/project-graph';
import { workspaceRoot } from '../workspace-root';
import { fetchCorePlugins } from './core-plugins';
import { getInstalledPluginsFromPackageJson } from './installed-plugins';
import { getLocalWorkspacePlugins } from './local-plugins';
import { PluginCapabilities } from './models';

export async function getAvailablePlugins(): Promise<PluginCapabilities[]> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });

  const localPlugins = getLocalWorkspacePlugins(
    readProjectsConfigurationFromProjectGraph(projectGraph)
  );

  const installedPlugins = getInstalledPluginsFromPackageJson(
    workspaceRoot,
    fetchCorePlugins(),
    []
  );

  return [...localPlugins.values(), ...installedPlugins.values()];
}
