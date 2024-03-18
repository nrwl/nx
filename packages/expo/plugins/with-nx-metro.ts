import { joinPathFragments, workspaceRoot } from '@nx/devkit';
import { mergeConfig } from 'metro-config';
import type { MetroConfig } from 'metro-config';
import { existsSync, readdirSync, statSync } from 'fs-extra';

import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  debug?: boolean;
  extensions?: string[];
  watchFolders?: string[];
}

export async function withNxMetro(
  userConfig: MetroConfig,
  opts: WithNxOptions = {}
) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  let watchFolders = readdirSync(workspaceRoot)
    .filter(
      (fileName) =>
        !['dist', 'e2e'].includes(fileName) && !fileName.startsWith('.')
    )
    .map((fileName) => joinPathFragments(workspaceRoot, fileName))
    .filter((filePath) => statSync(filePath).isDirectory());

  if (opts.watchFolders?.length) {
    watchFolders = watchFolders.concat(opts.watchFolders);
  }

  watchFolders = [...new Set(watchFolders)].filter((folder) =>
    existsSync(folder)
  );

  const nxConfig: MetroConfig = {
    resolver: {
      resolveRequest: getResolveRequest(extensions),
      nodeModulesPaths: [joinPathFragments(workspaceRoot, 'node_modules')],
    },
    watchFolders,
  };

  return mergeConfig(userConfig, nxConfig);
}
