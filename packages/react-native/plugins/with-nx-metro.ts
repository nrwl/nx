import { appRootPath } from '@nrwl/workspace/src/utils/app-root';
import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  debug?: boolean;
  extensions?: string[];
}

export function withNxMetro(config: any, opts: WithNxOptions = {}) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  // Set the root to workspace root so we can resolve modules and assets
  config.projectRoot = appRootPath;

  // Add support for paths specified by tsconfig
  config.resolver = {
    ...config.resolver,
    resolveRequest: getResolveRequest(extensions),
  };

  return config;
}
