import { workspaceLayout, workspaceRoot } from '@nx/devkit';
import { mergeConfig } from 'metro-config';
import type { MetroConfig } from 'metro-config';
import { join } from 'path';
import { existsSync } from 'fs-extra';

import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  debug?: boolean;
  extensions?: string[];
  /**
   * @deprecated TODO(v17) in the metro.config.js, pass in to the getDefaultConfig instead: getDefaultConfig(__dirname)
   */
  projectRoot?: string;
  watchFolders?: string[];
}

export async function withNxMetro(
  userConfig: MetroConfig,
  opts: WithNxOptions = {}
) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  let watchFolders = [
    join(workspaceRoot, 'node_modules'),
    join(workspaceRoot, workspaceLayout().libsDir),
    join(workspaceRoot, 'packages'),
    join(workspaceRoot, '.storybook'),
  ];
  if (opts.watchFolders?.length) {
    watchFolders = watchFolders.concat(opts.watchFolders);
  }

  watchFolders = watchFolders.filter((folder) => existsSync(folder));

  const nxConfig: MetroConfig = {
    resolver: {
      resolveRequest: getResolveRequest(extensions),
    },
    watchFolders,
  };

  return mergeConfig(userConfig, nxConfig);
}
