import {
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
  processTargetOutputs,
  interpolate,
  resolveNxTokensInOptions,
  toProjectRelativePath,
} from '@nx/devkit/internal';
import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { isAbsolute } from 'node:path';
import { basename, dirname, relative } from 'node:path/posix';
import { createNodes, type EslintPluginOptions } from '../../plugins/plugin';
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import { ESLINT_CONFIG_FILENAMES } from '../../utils/config-file';
import { targetOptionsToCliMap } from './lib/target-options-map';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  assertSupportedEslintVersion(tree);

  const projectGraph = await createProjectGraphAsync();

  const migratedProjects =
    await migrateProjectExecutorsToPlugin<EslintPluginOptions>(
      tree,
      projectGraph,
      '@nx/eslint/plugin',
      createNodes,
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
    const normalizeInput = (input: string) => {
      return input
        .replace('{workspaceRoot}', '')
        .replace('{projectRoot}', projectDetails.root)
        .replace('{projectName}', projectDetails.projectName)
        .replace(/^\//, '');
    };

    const inputs = target.inputs.filter((input) => {
      if (typeof input === 'string') {
        // if the input is a string, check if it is inferred by the plugin
        // if it is, filter it out
        return !inferredTargetConfiguration.inputs.some(
          (inferredInput) =>
            typeof inferredInput === 'string' &&
            normalizeInput(inferredInput) === normalizeInput(input)
        );
      } else if ('externalDependencies' in input) {
        // if the input is an object with an externalDependencies property,
        // check if all the external dependencies are inferred by the plugin
        // if they are, filter it out
        return !input.externalDependencies.every((externalDependency) =>
          inferredTargetConfiguration.inputs.some(
            (inferredInput) =>
              typeof inferredInput === 'object' &&
              'externalDependencies' in inferredInput &&
              inferredInput.externalDependencies.includes(externalDependency)
          )
        );
      }
    });
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

  for (const option of [
    'outputFile',
    'ignorePath',
    'resolvePluginsRelativeTo',
    'printConfig',
  ]) {
    if (!(option in options)) {
      continue;
    }
    // the executor treated an empty value as unset
    if (!options[option]) {
      delete options[option];
      continue;
    }
    options[option] = toProjectRootPath(
      options[option],
      option,
      projectDetails
    );
  }

  if (Array.isArray(options.rulesdir)) {
    options.rulesdir = options.rulesdir.map((dir: string) =>
      toProjectRootPath(dir, 'rulesdir', projectDetails)
    );
  }

  if (typeof options.format === 'string') {
    const format = resolveNxTokens(
      options.format,
      'format',
      projectDetails
    ).replace(/\\/g, '/');
    // ESLint loads a formatter from a file, resolved from its cwd, when the
    // name contains a `/` and is not a scoped package
    if (format.includes('/') && !/^@.*\//.test(format)) {
      const formatPath = toProjectRootPath(
        options.format,
        'format',
        projectDetails
      );
      options.format = /[\\/]/.test(formatPath)
        ? formatPath
        : `./${formatPath}`;
    }
  }

  // Nx rejects outputs outside the workspace, so such a report is not cached
  if (
    options.outputFile &&
    !/^\.\.(\/|$)/.test(
      joinPathFragments(projectDetails.root, options.outputFile)
    )
  ) {
    const output = '{projectRoot}/{options.output-file}';
    target.outputs ??= [];
    if (!target.outputs.includes(output)) {
      target.outputs.push(output);
    }
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

function resolveNxTokens(
  value: string,
  option: string,
  projectDetails: { projectName: string; root: string }
): string {
  return resolveNxTokensInOptions(
    { [option]: value },
    { root: projectDetails.root, name: projectDetails.projectName },
    option
  )[option];
}

/**
 * Rewrites a path the executor resolved from the workspace root so that ESLint
 * resolves it to the same location from the project root, where the inferred
 * target runs it.
 */
function toProjectRootPath(
  value: string,
  option: string,
  projectDetails: { projectName: string; root: string }
): string {
  const resolvedValue = resolveNxTokens(value, option, projectDetails);
  // A relative path to an absolute location would depend on where the
  // workspace is on disk. The executor joined the output file onto the
  // workspace root, so its leading `/` stays inside the workspace.
  if (option !== 'outputFile' && isAbsolute(resolvedValue)) {
    return resolvedValue;
  }

  return toProjectRelativePath(
    joinPathFragments('.', resolvedValue),
    projectDetails.root
  );
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
