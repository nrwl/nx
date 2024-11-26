import { type TargetConfiguration, type Tree } from '@nx/devkit';
import { toProjectRelativePath } from './utils';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';

export function testPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  if (target.options) {
    removePropertiesFromTargetOptions(target.options, projectDetails.root);
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      removePropertiesFromTargetOptions(configuration, projectDetails.root);
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

  if (target.outputs) {
    processTargetOutputs(
      target,
      [{ newName: 'coverage.reportsDirectory', oldName: 'reportsDirectory' }],
      inferredTargetConfiguration,
      {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      }
    );
  }

  if (
    target.inputs &&
    target.inputs.every((i) => i === 'default' || i === '^production')
  ) {
    delete target.inputs;
  }

  return target;
}

function removePropertiesFromTargetOptions(
  targetOptions: any,
  projectRoot: string
) {
  if ('configFile' in targetOptions) {
    targetOptions.config = toProjectRelativePath(
      targetOptions.configFile,
      projectRoot
    );
    delete targetOptions.configFile;
  }

  if ('reportsDirectory' in targetOptions) {
    if (targetOptions.reportsDirectory.startsWith('../')) {
      targetOptions.reportsDirectory = targetOptions.reportsDirectory.replace(
        /(\.\.\/)+/,
        ''
      );
    }
    targetOptions['coverage.reportsDirectory'] = toProjectRelativePath(
      targetOptions.reportsDirectory,
      projectRoot
    );
    delete targetOptions.reportsDirectory;
  }

  if ('testFiles' in targetOptions) {
    targetOptions.testNamePattern = `"/(${targetOptions.testFiles
      .map((f) => f.replace('.', '\\.'))
      .join('|')})/"`;
    delete targetOptions.testFiles;
  }
}
