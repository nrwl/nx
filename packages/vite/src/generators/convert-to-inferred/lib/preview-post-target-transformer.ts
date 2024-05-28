import {
  joinPathFragments,
  logger,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';

export function previewPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string }
) {
  const viteConfigPath = [
    joinPathFragments(projectDetails.root, `vite.config.ts`),
    joinPathFragments(projectDetails.root, `vite.config.js`),
  ].find((f) => tree.exists(f));

  if (target.options) {
    removePropertiesFromTargetOptions(target.options, viteConfigPath);
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      removePropertiesFromTargetOptions(configuration, viteConfigPath);

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
  targetOptions: any,
  viteConfigPath: string
) {
  if ('buildTarget' in targetOptions) {
    delete targetOptions.buildTarget;
  }

  if ('staticFilePath' in targetOptions) {
    delete targetOptions.staticFilePath;
  }

  if ('proxyConfig' in targetOptions) {
    logger.warn(
      `Encountered 'proxyConfig' in project.json when migrating '@nx/vite:preview-server'. You will need to copy the contents of this file to your ${viteConfigPath} 'server.proxy' property.`
    );
    delete targetOptions.proxyConfig;
  }
}
