import { ModuleFederationConfig, SharedLibraryConfig } from '../../utils';
import {
  createDefaultRemoteUrlResolver,
  FrameworkConfig,
  getModuleFederationConfigSync,
} from '../../utils/module-federation-config';
import { ProjectGraph } from '@nx/devkit';
import { applyDefaultEagerPackages as applyReactEagerPackages } from '../react/utils';
import { isReactProject } from '../../utils/framework-detection';

/**
 * Creates the default remote URL resolver for rspack.
 * Kept for backward compatibility with existing configs.
 */
export function getFunctionDeterminateRemoteUrl(isServer = false) {
  return createDefaultRemoteUrlResolver(isServer, 'js');
}

/**
 * Framework config for rspack projects (React).
 */
function getRspackFrameworkConfig(): FrameworkConfig {
  return {
    bundler: 'rspack',
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

export function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false }
) {
  return getModuleFederationConfigSync(
    mfConfig,
    options,
    getRspackFrameworkConfig()
  );
}
