import { get } from 'https';
import * as chalk from 'chalk';
import { output } from '../output';
import type { CommunityPlugin, PluginCapabilities } from './models';

const COMMUNITY_PLUGINS_JSON_URL =
  'https://raw.githubusercontent.com/nrwl/nx/master/community/approved-plugins.json';

export async function fetchCommunityPlugins(): Promise<CommunityPlugin[]> {
  return new Promise((resolve, reject) => {
    const req = get(COMMUNITY_PLUGINS_JSON_URL, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Request failed with status code ${res.statusCode}`));
      }

      const data = [];
      res.on('data', (chunk) => {
        data.push(chunk);
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(data).toString('utf-8')));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export function listCommunityPlugins(
  installedPlugins: Map<string, PluginCapabilities>,
  communityPlugins?: CommunityPlugin[]
): void {
  if (!communityPlugins) return;

  const availableCommunityPlugins = communityPlugins.filter(
    (p) => !installedPlugins.has(p.name)
  );

  output.log({
    title: `Community plugins:`,
    bodyLines: availableCommunityPlugins.map((p) => {
      return `${chalk.bold(p.name)} - ${p.description}`;
    }),
  });
}
