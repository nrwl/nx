import { ModuleFederationConfig, SharedLibraryConfig } from '../../utils';
import {
  createDefaultRemoteUrlResolver,
  FrameworkConfig,
  getModuleFederationConfigAsync,
} from '../../utils/module-federation-config';
import { ProjectGraph } from '@nx/devkit';
import { applyDefaultEagerPackages as applyReactEagerPackages } from '../react/utils';
import { isReactProject } from '../../utils/framework-detection';

/**
 * Creates the default remote URL resolver for webpack.
 * Kept for backward compatibility with existing configs.
 */
export function getFunctionDeterminateRemoteUrl(isServer: boolean = false) {
  return createDefaultRemoteUrlResolver(isServer, 'js');
}

/**
 * Framework config for webpack projects (React).
 */
function getWebpackFrameworkConfig(
  bundler: 'rspack' | 'webpack' = 'rspack'
): FrameworkConfig {
  return {
    bundler,
    remoteEntryExt: 'js',
    mapRemotesExpose: true,
    applyEagerPackages: (
      sharedConfig: Record<string, SharedLibraryConfig>,
      projectGraph: ProjectGraph,
      projectName: string
    ) => {
      if (isReactProject(projectName, projectGraph)) {
        applyReactEagerPackages(sharedConfig);
      }
    },
  };
}

export async function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false },
  bundler: 'rspack' | 'webpack' = 'rspack'
) {
  return getModuleFederationConfigAsync(
    mfConfig,
    options,
    getWebpackFrameworkConfig(bundler)
  );
}
