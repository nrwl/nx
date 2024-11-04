import {
  createProjectGraphAsync,
  formatFiles,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
} from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { basename, dirname, relative } from 'node:path/posix';
import { interpolate } from 'nx/src/tasks-runner/utils';
import { createNodesV2, type EslintPluginOptions } from '../../plugins/plugin';
import { ESLINT_CONFIG_FILENAMES } from '../../utils/config-file';
import { targetOptionsToCliMap } from './lib/target-options-map';

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
          skipTargetFilter,
        },
      ],
      options.project
    );

  if (migratedProjects.size === 0) {
    throw new NoTargetsToMigrateError();
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
  // inferred targets are only identified after known files that ESLint would
  // pick up, so we can remove the eslintConfig option
  delete options.eslintConfig;

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
        const interpolatedPattern = interpolate(pattern, {
          workspaceRoot: '',
          projectRoot: projectDetails.root,
          projectName: projectDetails.projectName,
        });

        if (interpolatedPattern === projectDetails.root) {
          return '.';
        }

        return interpolatedPattern.replace(
          new RegExp(`^(?:\./)?${projectDetails.root}/`),
          ''
        );
      }
    );

    options.args = normalizedLintFilePatterns
      // the @nx/eslint/plugin automatically infers these, so we don't need to pass them in
      .filter((p) =>
        projectDetails.root === '.'
          ? !['.', 'src', './src', 'lib', './lib'].includes(p)
          : p !== '.'
      );
    if (options.args.length === 0) {
      delete options.args;
    }

    delete options.lintFilePatterns;
  }
}

export default convertToInferred;

function skipTargetFilter(
  targetOptions: { eslintConfig?: string },
  project: ProjectConfiguration
) {
  if (targetOptions.eslintConfig) {
    // check that the eslintConfig option is a default config file known by ESLint
    if (
      !ESLINT_CONFIG_FILENAMES.includes(basename(targetOptions.eslintConfig))
    ) {
      return `The "eslintConfig" option value (${targetOptions.eslintConfig}) is not a default config file known by ESLint.`;
    }

    // check that it is at the project root or in a parent directory
    const eslintConfigPath = relative(project.root, targetOptions.eslintConfig);
    if (
      dirname(eslintConfigPath) !== '.' &&
      !eslintConfigPath.startsWith('../')
    ) {
      return `The "eslintConfig" option value (${targetOptions.eslintConfig}) must point to a file in the project root or a parent directory.`;
    }
  }

  return false;
}
