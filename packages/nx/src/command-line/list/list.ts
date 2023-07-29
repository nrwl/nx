import { workspaceRoot } from '../../utils/workspace-root';
import { output } from '../../utils/output';
import {
  fetchCorePlugins,
  getInstalledPluginsAndCapabilities,
  listCorePlugins,
  listInstalledPlugins,
  listPluginCapabilities,
} from '../../utils/plugins';
import {
  getLocalWorkspacePlugins,
  listLocalWorkspacePlugins,
} from '../../utils/plugins/local-plugins';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';

export interface ListArgs {
  /** The name of an installed plugin to query  */
  plugin?: string | undefined;
}

/**
 * List available plugins or capabilities within a specific plugin
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export async function listHandler(args: ListArgs): Promise<void> {
  if (args.plugin) {
    await listPluginCapabilities(args.plugin);
  } else {
    const corePlugins = fetchCorePlugins();
    const projectGraph = await createProjectGraphAsync({ exitOnError: true });

    const localPlugins = await getLocalWorkspacePlugins(
      readProjectsConfigurationFromProjectGraph(projectGraph)
    );
    const installedPlugins = await getInstalledPluginsAndCapabilities(
      workspaceRoot
    );

    if (localPlugins.size) {
      listLocalWorkspacePlugins(localPlugins);
    }
    listInstalledPlugins(installedPlugins);
    listCorePlugins(installedPlugins, corePlugins);

    output.note({
      title: 'Community Plugins',
      bodyLines: [
        'Looking for a technology / framework not listed above?',
        'There are many excellent plugins maintained by the Nx community.',
        'Search for the one you need here: https://nx.dev/plugins/registry.',
      ],
    });

    output.note({
      title: `Use "nx list [plugin]" to find out more`,
    });
  }
}
