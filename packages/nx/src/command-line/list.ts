import { workspaceRoot } from '../utils/workspace-root';
import { output } from '../utils/output';
import {
  fetchCommunityPlugins,
  fetchCorePlugins,
  getInstalledPluginsFromPackageJson,
  listCommunityPlugins,
  listCorePlugins,
  listInstalledPlugins,
  listPluginCapabilities,
} from '../utils/plugins';
import {
  fetchThirdPartyPlugins,
  listThirdPartyPlugins,
} from '../utils/plugins/custom-plugins';

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
    listPluginCapabilities(args.plugin);
  } else {
    const corePlugins = fetchCorePlugins();
    const communityPlugins = await fetchCommunityPlugins().catch(() => {
      output.warn({
        title: `Community plugins:`,
        bodyLines: [`Error fetching plugins.`],
      });

      return [];
    });
    let thirdPartyPlugins;
    try {
      thirdPartyPlugins = (await fetchThirdPartyPlugins()).flat();
    } catch (error) {
      output.warn({
        title: `Error fetching 3rd Party plugins:`,
        bodyLines: [`Error fetching plugins in nx-plugin.conf`],
      });

      thirdPartyPlugins = [];
    }

    const installedPlugins = getInstalledPluginsFromPackageJson(
      workspaceRoot,
      corePlugins,
      communityPlugins,
      thirdPartyPlugins
    );
    listInstalledPlugins(installedPlugins);
    listCorePlugins(installedPlugins, corePlugins);
    listCommunityPlugins(installedPlugins, communityPlugins);
    listThirdPartyPlugins(installedPlugins, thirdPartyPlugins);

    output.note({
      title: `Use "nx list [plugin]" to find out more`,
    });
  }
}
