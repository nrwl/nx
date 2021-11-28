import { workspaceLayout } from '@nrwl/workspace/src/core/file-utils';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import { join } from 'path';
import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  debug?: boolean;
  extensions?: string[];
}

export function withNxMetro(config: any, opts: WithNxOptions = {}) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  // Set the root to workspace root so we can resolve modules and assets
  config.projectRoot = appRootPath;

  const watchFolders = config.watchFolders || [];
  config.watchFolders = watchFolders.concat([
    join(appRootPath, 'node_modules'),
    join(appRootPath, workspaceLayout().libsDir),
  ]);

  // Add support for paths specified by tsconfig
  config.resolver = {
    ...config.resolver,
    resolveRequest: getResolveRequest(extensions),
  };

  return config;
}
