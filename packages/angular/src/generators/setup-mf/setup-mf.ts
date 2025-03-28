import {
  addDependenciesToPackageJson,
  formatFiles,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  moduleFederationEnhancedVersion,
  nxVersion,
} from '../../utils/versions';
import {
  addCypressOnErrorWorkaround,
  addRemoteEntry,
  addRemoteToHost,
  changeBuildTarget,
  fixBootstrap,
  generateWebpackConfig,
  getRemotesWithPorts,
  moveAngularPluginToDependencies,
  normalizeOptions,
  removeDeadCodeFromRemote,
  setupHostIfDynamic,
  setupServeTarget,
  setupTspathForRemote,
  updateHostAppRoutes,
  updateTsConfig,
} from './lib';
import type { Schema } from './schema';

export async function setupMf(tree: Tree, rawOptions: Schema) {
  const options = normalizeOptions(tree, rawOptions);
  const projectConfig = readProjectConfiguration(tree, options.appName);

  let installTask = () => {};
  if (options.mfType === 'remote') {
    addRemoteToHost(tree, {
      appName: options.appName,
      host: options.host,
      standalone: options.standalone,
      port: options.port,
    });
    addRemoteEntry(tree, options, projectConfig.root);
    removeDeadCodeFromRemote(tree, options);
    setupTspathForRemote(tree, options);
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        tree,
        {
          '@module-federation/enhanced': moduleFederationEnhancedVersion,
        },
        {
          '@nx/web': nxVersion,
          '@nx/webpack': nxVersion,
          '@nx/module-federation': nxVersion,
        }
      );
    }
  }

  const remotesWithPorts = getRemotesWithPorts(tree, options);

  generateWebpackConfig(tree, options, projectConfig.root, remotesWithPorts);

  changeBuildTarget(tree, options);
  updateTsConfig(tree, options);
  setupServeTarget(tree, options);

  if (options.mfType === 'host') {
    setupHostIfDynamic(tree, options);
    updateHostAppRoutes(tree, options);
    for (const { remoteName, port } of remotesWithPorts) {
      addRemoteToHost(tree, {
        appName: remoteName,
        host: options.appName,
        standalone: options.standalone,
        port,
      });
    }
    if (!options.skipPackageJson) {
      installTask = addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/webpack': nxVersion,
          '@module-federation/enhanced': moduleFederationEnhancedVersion,
          '@nx/module-federation': nxVersion,
        }
      );
    }
  }

  fixBootstrap(tree, projectConfig.root, options);

  if (options.mfType === 'host' || options.federationType === 'dynamic') {
    /**
     * Host applications and dynamic federation applications generate runtime
     * code that depends on the @nx/angular plugin. Ensure that the plugin is
     * in the production dependencies.
     */
    moveAngularPluginToDependencies(tree);
  }

  if (!options.skipE2E) {
    addCypressOnErrorWorkaround(tree, options);
  }

  // format files
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default setupMf;
