import { readNxJson } from '../../config/nx-json';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import {
  getInstalledPluginsAndCapabilities,
  getLocalWorkspacePlugins,
  listAlsoAvailableCorePlugins,
  listPluginCapabilities,
  listPlugins,
} from '../../utils/plugins';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  formatPluginsAsJson,
  listPowerpackPlugins,
} from '../../utils/plugins/output';

export interface ListArgs {
  /** The name of an installed plugin to query  */
  plugin?: string | undefined;
  /** Output as JSON */
  json?: boolean;
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
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = readProjectsConfigurationFromProjectGraph(projectGraph);

  if (args.plugin) {
    await listPluginCapabilities(args.plugin, projects.projects, args.json);
  } else {
    const nxJson = readNxJson();

    const localPlugins = await getLocalWorkspacePlugins(projects, nxJson);
    const installedPlugins = await getInstalledPluginsAndCapabilities(
      workspaceRoot,
      projects.projects
    );

    if (args.json) {
      console.log(
        JSON.stringify(
          formatPluginsAsJson(localPlugins, installedPlugins),
          null,
          2
        )
      );
      return;
    }

    if (localPlugins.size) {
      listPlugins(localPlugins, 'Local workspace plugins:');
    }
    listPlugins(installedPlugins, 'Installed plugins:');
    listAlsoAvailableCorePlugins(installedPlugins);
    listPowerpackPlugins();

    output.note({
      title: 'Community Plugins',
      bodyLines: [
        'Looking for a technology / framework not listed above?',
        'There are many excellent plugins maintained by the Nx community.',
        'Search for the one you need here: https://nx.dev/plugin-registry.',
      ],
    });

    output.note({ title: `Use "nx list [plugin]" to find out more` });
  }
}
