import {
  createProjectGraphAsync,
  formatFiles,
  names,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { createNodesV2, EslintPluginOptions } from '../../plugins/plugin';
import { migrateProjectExecutorsToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { targetOptionsToCliMap } from './lib/target-options-map';
import { interpolate } from 'nx/src/tasks-runner/utils';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();

  const migratedProjects =
    await migrateProjectExecutorsToPlugin<EslintPluginOptions>(
      tree,
      projectGraph,
      '@nx/eslint/plugin',
      createNodesV2,
      { targetName: 'lint' },
      [
        {
          executors: ['@nx/eslint:lint', '@nrwl/linter:eslint'],
          postTargetTransformer,
          targetPluginOptionMapper: (targetName) => ({ targetName }),
        },
      ],
      options.project
    );

  if (migratedProjects.size === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function postTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
): TargetConfiguration {
  if (target.inputs) {
    const inputs = target.inputs.filter(
      (input) =>
        typeof input === 'string' &&
        ![
          'default',
          '{workspaceRoot}/.eslintrc.json',
          '{workspaceRoot}/.eslintignore',
          '{workspaceRoot}/eslint.config.js',
        ].includes(input)
    );
    if (inputs.length === 0) {
      delete target.inputs;
    }
  }

  if (target.options) {
    handlePropertiesInOptions(target.options, projectDetails, target);
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      handlePropertiesInOptions(configuration, projectDetails, target);
    }

    if (Object.keys(target.configurations).length !== 0) {
      for (const configuration in target.configurations) {
        if (Object.keys(target.configurations[configuration]).length === 0) {
          delete target.configurations[configuration];
        }
      }
      if (Object.keys(target.configurations).length === 0) {
        delete target.configurations;
      }
    }
  }

  if (target.outputs) {
    processTargetOutputs(target, [], inferredTargetConfiguration, {
      projectName: projectDetails.projectName,
      projectRoot: projectDetails.root,
    });
  }

  return target;
}

function handlePropertiesInOptions(
  options: Record<string, any>,
  projectDetails: { projectName: string; root: string },
  target: TargetConfiguration
) {
  if ('eslintConfig' in options) {
    options.config = toProjectRelativePath(
      options.eslintConfig,
      projectDetails.root
    );
    delete options.eslintConfig;
  }

  if ('force' in options) {
    delete options.force;
  }

  if ('silent' in options) {
    delete options.silent;
  }

  if ('hasTypeAwareRules' in options) {
    delete options.hasTypeAwareRules;
  }

  if ('errorOnUnmatchedPattern' in options) {
    if (!options.errorOnUnmatchedPattern) {
      options['no-error-on-unmatched-pattern'] = true;
    }
    delete options.errorOnUnmatchedPattern;
  }

  if ('outputFile' in options) {
    target.outputs ??= [];
    target.outputs.push(options.outputFile);
  }

  for (const key in targetOptionsToCliMap) {
    if (options[key]) {
      const prevValue = options[key];
      delete options[key];
      options[targetOptionsToCliMap[key]] = prevValue;
    }
  }

  if ('lintFilePatterns' in options) {
    const normalizedLintFilePatterns = options.lintFilePatterns.map(
      (pattern) => {
        return interpolate(pattern, {
          workspaceRoot: '',
          projectRoot: projectDetails.root,
          projectName: projectDetails.projectName,
        });
      }
    );

    options.args = normalizedLintFilePatterns.map((pattern) =>
      pattern.startsWith(projectDetails.root)
        ? pattern.replace(new RegExp(`^${projectDetails.root}/`), './')
        : pattern
    );

    delete options.lintFilePatterns;
  }
}

export default convertToInferred;
