import * as yargs from 'yargs';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { output } from '../utilities/output';
import {
  fetchCommunityPlugins,
  fetchCorePlugins,
  getInstalledPluginsFromPackageJson,
  listCommunityPlugins,
  listCorePlugins,
  listInstalledPlugins,
  listPluginCapabilities,
} from '../utilities/plugins';

export interface YargsListArgs extends yargs.Arguments, ListArgs {}

interface ListArgs {
  plugin?: string;
}

export const list = {
  command: 'list [plugin]',
  describe:
    'Lists installed plugins, capabilities of installed plugins and other available plugins.',
  builder: (yargs: yargs.Argv) =>
    yargs.positional('plugin', {
      default: null,
      description: 'The name of an installed plugin to query',
    }),
  handler: listHandler,
};

/**
 * List available plugins or capabilities within a specific plugin
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
async function listHandler(args: YargsListArgs) {
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

    const installedPlugins = getInstalledPluginsFromPackageJson(
      appRootPath,
      corePlugins,
      communityPlugins
    );
    listInstalledPlugins(installedPlugins);
    listCorePlugins(installedPlugins, corePlugins);
    listCommunityPlugins(installedPlugins, communityPlugins);

    output.note({
      title: `Use "nx list [plugin]" to find out more`,
    });
  }
}
