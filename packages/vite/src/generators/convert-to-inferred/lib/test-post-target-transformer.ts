import {
  joinPathFragments,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';

export function testPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string }
) {
  if (target.options) {
    removePropertiesFromTargetOptions(target.options);
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      removePropertiesFromTargetOptions(configuration);

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

  if (
    target.outputs &&
    target.outputs.length === 1 &&
    target.outputs[0] === '{options.reportsDirectory}'
  ) {
    delete target.outputs;
  }

  if (
    target.inputs &&
    target.inputs.every((i) => i === 'default' || i === '^production')
  ) {
    delete target.inputs;
  }

  return target;
}

function removePropertiesFromTargetOptions(targetOptions: any) {
  if ('configFile' in targetOptions) {
    targetOptions.config = targetOptions.configFile;
    delete targetOptions.configFile;
  }

  if ('reportsDirectory' in targetOptions) {
    targetOptions['coverage.reportsDirectory'] = targetOptions.reportsDirectory;
    delete targetOptions.reportsDirectory;
  }

  if ('testFiles' in targetOptions) {
    targetOptions.testNamePattern = `/(${targetOptions.testFiles
      .map((f) => f.replace('.', '\\.'))
      .join('|')})/`;
    delete targetOptions.testFiles;
  }
}
