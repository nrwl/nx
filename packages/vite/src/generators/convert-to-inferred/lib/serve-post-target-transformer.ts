import {
  joinPathFragments,
  logger,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { moveBuildLibsFromSourceToViteConfig } from './build-post-target-transformer';

export function servePostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  const viteConfigPath = [
    joinPathFragments(projectDetails.root, `vite.config.ts`),
    joinPathFragments(projectDetails.root, `vite.config.js`),
  ].find((f) => tree.exists(f));

  if (target.options) {
    removePropertiesFromTargetOptions(
      tree,
      target.options,
      viteConfigPath,
      projectDetails.root,
      true
    );
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      removePropertiesFromTargetOptions(
        tree,
        configuration,
        viteConfigPath,
        projectDetails.root
      );

      if (Object.keys(configuration).length === 0) {
        delete target.configurations[configurationName];
      }
    }

    if (Object.keys(target.configurations).length === 0) {
      if ('defaultConfiguration' in target) {
        delete target.defaultConfiguration;
      }
      delete target.configurations;
    }

    if (
      'defaultConfiguration' in target &&
      !target.configurations[target.defaultConfiguration]
    ) {
      delete target.defaultConfiguration;
    }
  }

  return target;
}

function removePropertiesFromTargetOptions(
  tree: Tree,
  targetOptions: any,
  viteConfigPath: string,
  projectRoot: string,
  defaultOptions = false
) {
  if ('buildTarget' in targetOptions) {
    delete targetOptions.buildTarget;
  }

  if ('buildLibsFromSource' in targetOptions) {
    if (defaultOptions) {
      moveBuildLibsFromSourceToViteConfig(
        tree,
        targetOptions.buildLibsFromSource,
        viteConfigPath
      );
    }
    delete targetOptions.buildLibsFromSource;
  }

  if ('hmr' in targetOptions) {
    delete targetOptions.hmr;
  }

  if ('proxyConfig' in targetOptions) {
    logger.warn(
      `Encountered 'proxyConfig' in project.json when migrating '@nx/vite:dev-server'. You will need to copy the contents of this file to your ${viteConfigPath} 'server.proxy' property.`
    );
    delete targetOptions.proxyConfig;
  }
}
