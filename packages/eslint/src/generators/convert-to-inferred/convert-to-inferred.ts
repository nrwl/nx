import {
  createProjectGraphAsync,
  formatFiles,
  names,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { createNodesV2, EslintPluginOptions } from '../../plugins/plugin';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { targetOptionsToCliMap } from './lib/target-options-map';
import { interpolate } from 'nx/src/tasks-runner/utils';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();

  const migratedProjectsModern =
    await migrateExecutorToPlugin<EslintPluginOptions>(
      tree,
      projectGraph,
      '@nx/eslint:lint',
      '@nx/eslint/plugin',
      (targetName) => ({ targetName }),
      postTargetTransformer,
      createNodesV2,
      options.project
    );

  const migratedProjectsLegacy =
    await migrateExecutorToPlugin<EslintPluginOptions>(
      tree,
      projectGraph,
      '@nrwl/linter:eslint',
      '@nx/eslint/plugin',
      (targetName) => ({ targetName }),
      postTargetTransformer,
      createNodesV2,
      options.project
    );

  const migratedProjects =
    migratedProjectsModern.size + migratedProjectsLegacy.size;
  if (migratedProjects === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function postTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string }
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
    if ('eslintConfig' in target.options) {
      delete target.options.eslintConfig;
    }

    if ('force' in target.options) {
      delete target.options.force;
    }

    if ('silent' in target.options) {
      delete target.options.silent;
    }

    if ('hasTypeAwareRules' in target.options) {
      delete target.options.hasTypeAwareRules;
    }

    if ('errorOnUnmatchedPattern' in target.options) {
      if (!target.options.errorOnUnmatchedPattern) {
        target.options['no-error-on-unmatched-pattern'] = true;
      }
      delete target.options.errorOnUnmatchedPattern;
    }

    if ('outputFile' in target.options) {
      target.outputs ??= [];
      target.outputs.push(target.options.outputFile);
    }

    for (const key in targetOptionsToCliMap) {
      if (target.options[key]) {
        target.options[targetOptionsToCliMap[key]] = target.options[key];
        delete target.options[key];
      }
    }

    if ('lintFilePatterns' in target.options) {
      const normalizedLintFilePatterns = target.options.lintFilePatterns.map(
        (pattern) => {
          return interpolate(pattern, {
            workspaceRoot: '',
            projectRoot: projectDetails.root,
            projectName: projectDetails.projectName,
          });
        }
      );

      target.options.args = normalizedLintFilePatterns.map((pattern) =>
        pattern.startsWith(projectDetails.root)
          ? pattern.replace(new RegExp(`^${projectDetails.root}/`), './')
          : pattern
      );

      delete target.options.lintFilePatterns;
    }
  }

  return target;
}

export default convertToInferred;
