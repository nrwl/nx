import { terminal } from '@angular-devkit/core';
import axios from 'axios';
import { output } from './output';

const APPROVED_PLUGINS_JSON_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/community/approved-plugins.json';

interface CommunityPlugin {
  name: string;
  url: string;
  description: string;
}

async function fetchCommunityPlugins(): Promise<CommunityPlugin[]> {
  const response = await axios.get<CommunityPlugin[]>(
    APPROVED_PLUGINS_JSON_URL
  );

  return response.data;
}

export async function listCommunityPlugins(installedPluginsMap: Set<string>) {
  try {
    const communityPlugins = await fetchCommunityPlugins();

    const availableCommunityPlugins = communityPlugins.filter(
      p => !installedPluginsMap.has(p.name)
    );

    output.log({
      title: `Community plugins:`,
      bodyLines: availableCommunityPlugins.map(p => {
        return `${terminal.bold(p.name)} - ${p.description}`;
      })
    });
  } catch (error) {
    output.warn({
      title: `Community plugins:`,
      bodyLines: [`Error fetching plugins.`, error]
    });
  }
}
