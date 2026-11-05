import { type TargetConfiguration, type Tree } from '@nx/devkit';
import {
  processTargetOutputs,
  resolveNxTokensInOptions,
} from '@nx/devkit/internal';
import { posix } from 'node:path';
import { vitestConfigFileNamePatterns } from '../../../utils/config-file-names';
import { toProjectRelativePath } from './utils';

export function testPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  const mappedConfigFile = toMappedConfigFile(target.options?.configFile);

  if (target.options) {
    removePropertiesFromTargetOptions(
      target.options,
      projectDetails,
      mappedConfigFile
    );
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      removePropertiesFromTargetOptions(
        configuration,
        projectDetails,
        mappedConfigFile
      );
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
  projectDetails: { projectName: string; root: string },
  mappedConfigFile: string | undefined
) {
  const projectRoot = projectDetails.root;
  if (
    mappedConfigFile &&
    'configFile' in targetOptions &&
    posix.normalize(targetOptions.configFile) === mappedConfigFile
  ) {
    delete targetOptions.configFile;
  } else if ('configFile' in targetOptions) {
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
    const { reportsDirectory } = resolveNxTokensInOptions(
      { reportsDirectory: targetOptions.reportsDirectory },
      { root: projectRoot, name: projectDetails.projectName },
      'reportsDirectory'
    );
    targetOptions['coverage.reportsDirectory'] = toProjectRelativePath(
      reportsDirectory,
      projectRoot
    );
    delete targetOptions.reportsDirectory;
  }

  // A later --coverage replaces the whole coverage object on the Vitest CLI
  if (typeof targetOptions.coverage === 'boolean') {
    targetOptions['coverage.enabled'] = targetOptions.coverage;
    delete targetOptions.coverage;
  }

  for (const name of ['testFiles', 'testFile']) {
    if (name in targetOptions) {
      const filters: string[] = resolveNxTokensInOptions(
        [targetOptions[name]].flat(),
        { root: projectRoot, name: projectDetails.projectName },
        name
      );
      targetOptions.args = filters.map((filter) =>
        toProjectFilter(filter, projectRoot)
      );
      delete targetOptions[name];
    }
  }
}

// A configFile with another name reaches the converter only when
// configToTargetName infers it, and the inferred command already passes it
function toMappedConfigFile(configFile: unknown): string | undefined {
  if (typeof configFile !== 'string') {
    return undefined;
  }
  const path = posix.normalize(configFile);
  return vitestConfigFileNamePatterns.defaultName.test(posix.basename(path))
    ? undefined
    : path;
}

// Vitest resolves a relative filter against the cwd, which is now the project
// root. nx:run-commands joins args with spaces, so a filter with one is quoted.
function toProjectFilter(filter: string, projectRoot: string): string {
  const normalized = posix.normalize(filter);
  const prefix = `${posix.normalize(projectRoot)}/`;
  const relative = normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
  return relative.includes(' ') ? `"${relative}"` : relative;
}
