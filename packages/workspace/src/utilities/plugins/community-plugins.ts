import * as chalk from 'chalk';
import axios from 'axios';
import { output } from '../output';
import { CommunityPlugin, PluginCapabilities } from './models';

const COMMUNITY_PLUGINS_JSON_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/community/approved-plugins.json';

export async function fetchCommunityPlugins(): Promise<CommunityPlugin[]> {
  const response = await axios.get<CommunityPlugin[]>(
    COMMUNITY_PLUGINS_JSON_URL
  );

  return response.data;
}

export function listCommunityPlugins(
  installedPlugins: PluginCapabilities[],
  communityPlugins: CommunityPlugin[]
) {
  try {
    const installedPluginsMap: Set<string> = new Set<string>(
      installedPlugins.map((p) => p.name)
    );

    const availableCommunityPlugins = communityPlugins.filter(
      (p) => !installedPluginsMap.has(p.name)
    );

    output.log({
      title: `Community plugins:`,
      bodyLines: availableCommunityPlugins.map((p) => {
        return `${chalk.bold(p.name)} - ${p.description}`;
      }),
    });
  } catch (error) {
    output.warn({
      title: `Community plugins:`,
      bodyLines: [`Error fetching plugins.`, error],
    });
  }
}
