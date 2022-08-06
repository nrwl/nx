import { get } from 'https';
import * as chalk from 'chalk';
import { output } from '../output';
import type { CustomPlugin, PluginCapabilities } from './models';
import { readFileSync } from 'fs';
import { logger } from '../logger';

const CONFIG_FILE_NAME = 'nx-plugin.conf';

export async function fetchThirdPartyPlugins(): Promise<CustomPlugin[]> {
  let thirdPartyPluginsList;

  try {
    thirdPartyPluginsList = readFileSync(CONFIG_FILE_NAME, {
      encoding: 'utf-8',
    });
  } catch (error) {
    if (error.code === 'ENOENT')
      logger.debug('No thirdparty plugins found in project repository');
    return [];
  }
  return [
    ...(await Promise.all<CustomPlugin>(
      thirdPartyPluginsList.split('\n').filter(Boolean).map((link: string) => {
        if (link.toLowerCase().startsWith('http://')) {
          logger.warn({ title: 'HTTP based url detected in plugin config.' });
          throw new Error('HTTP URL found in the list');
        }
        return new Promise((resolve, reject) => {
          const req = get(link, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(
                new Error(`Request failed with status code ${res.statusCode}`)
              );
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
      })
    )),
  ];
}

export function listThirdPartyPlugins(
  installedPlugins: Map<string, PluginCapabilities>,
  customPlugins?: CustomPlugin[]
): void {
  if (!customPlugins || !customPlugins.length) return;

  const availableCommunityPlugins = customPlugins.filter(
    (p) => !installedPlugins.has(p.name)
  );

  output.log({
    title: `Third party plugins:`,
    bodyLines: availableCommunityPlugins.map((p) => {
      return `${chalk.bold(p.name)} - ${p.description}`;
    }),
  });
}
