import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export async function resolveUserDefinedRspackConfig(
  path: string,
  tsConfig: string,
  /** Skip require cache and return latest content */
  reload = false
) {
  return await loadConfigFile(path);
}
