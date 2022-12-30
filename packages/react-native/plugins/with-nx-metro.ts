import { workspaceLayout, workspaceRoot } from '@nrwl/devkit';
import { join } from 'path';
import { existsSync } from 'fs-extra';

import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  debug?: boolean;
  extensions?: string[];
  projectRoot?: string;
  watchFolders?: string[];
}

export function withNxMetro(config: any, opts: WithNxOptions = {}) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  config.projectRoot = opts.projectRoot || workspaceRoot;

  // Add support for paths specified by tsconfig
  config.resolver = {
    ...config.resolver,
    resolveRequest: getResolveRequest(extensions),
  };

  let watchFolders = config.watchFolders || [];
  watchFolders = watchFolders.concat([
    join(workspaceRoot, 'node_modules'),
    join(workspaceRoot, workspaceLayout().libsDir),
    join(workspaceRoot, '.storybook'),
  ]);
  if (opts.watchFolders?.length) {
    watchFolders = watchFolders.concat(opts.watchFolders);
  }

  watchFolders = watchFolders.filter((folder) => existsSync(folder));
  config.watchFolders = watchFolders;

  return config;
}
