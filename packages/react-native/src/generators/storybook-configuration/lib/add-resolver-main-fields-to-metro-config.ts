import {
  logger,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nx/devkit';
import { join } from 'path';

import { StorybookConfigureSchema } from '../schema';

/**
 * Add resolverMainFields in metro.config.js
 */
export function addResolverMainFieldsToMetroConfig(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const { root } = readProjectConfiguration(host, schema.name);

  const metroConfigPath = join(root, 'metro.config.js');

  try {
    logger.debug(`Updating resolverMainFields for ${metroConfigPath}`);
    const metroConfigContent = host.read(metroConfigPath, 'utf-8');
    if (metroConfigContent.includes('resolverMainFields:')) {
      logger.warn(stripIndents`${metroConfigPath} is already udpated.`);
      return;
    }
    host.write(
      metroConfigPath,
      metroConfigContent.replace(
        /},\s+resolver: {/,
        `},resolver: { resolverMainFields: ['sbmodern', 'browser', 'main'],`
      )
    );
  } catch {
    logger.error(
      stripIndents`Unable to update ${metroConfigPath} for project ${root}.`
    );
  }
}
