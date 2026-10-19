import { processTargetOutputs } from '@nx/devkit/internal';
import {
  joinPathFragments,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  addConfigValuesToViteConfig,
  getViteConfigPath,
  toProjectRelativePath,
} from './utils';

export function buildPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  let viteConfigPath = getViteConfigPath(tree, projectDetails.root);

  const configValues: Record<string, Record<string, unknown>> = {
    default: {},
  };

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      configValues[configurationName] = {};
      removePropertiesFromTargetOptions(
        configuration,
        projectDetails.root,
        configValues[configurationName]
      );
    }

    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      if (
        configuration.config &&
        configuration.config !==
          toProjectRelativePath(viteConfigPath, projectDetails.root)
      ) {
        const configFilePath = joinPathFragments(
          projectDetails.root,
          configuration.config
        );
        addConfigValuesToViteConfig(tree, configFilePath, configValues);
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

  if (target.options) {
    if (target.options.configFile) {
      viteConfigPath = target.options.configFile;
    }

    removePropertiesFromTargetOptions(
      target.options,
      projectDetails.root,
      configValues['default']
    );
  }

  if (target.outputs) {
    processTargetOutputs(
      target,
      [{ newName: 'outDir', oldName: 'outputPath' }],
      inferredTargetConfiguration,
      {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      }
    );
  }

  if (
    target.inputs &&
    target.inputs.every((i) => i === 'production' || i === '^production')
  ) {
    delete target.inputs;
  }

  addConfigValuesToViteConfig(tree, viteConfigPath, configValues);

  return target;
}

function removePropertiesFromTargetOptions(
  targetOptions: any,
  projectRoot: string,
  configValues: Record<string, unknown>
) {
  if ('configFile' in targetOptions) {
    targetOptions.config = toProjectRelativePath(
      targetOptions.configFile,
      projectRoot
    );
    delete targetOptions.configFile;
  }
  if (targetOptions.outputPath) {
    targetOptions.outDir = toProjectRelativePath(
      targetOptions.outputPath,
      projectRoot
    );

    delete targetOptions.outputPath;
  }
  if ('buildLibsFromSource' in targetOptions) {
    delete targetOptions.buildLibsFromSource;
  }
  if ('skipTypeCheck' in targetOptions) {
    delete targetOptions.skipTypeCheck;
  }
  if ('generatePackageJson' in targetOptions) {
    delete targetOptions.generatePackageJson;
  }
  if ('includeDevDependenciesInPackageJson' in targetOptions) {
    delete targetOptions.includeDevDependenciesInPackageJson;
  }
  if ('tsConfig' in targetOptions) {
    delete targetOptions.tsConfig;
  }
}
