import {
  createTargetDefaultsResults,
  migrateProjectExecutorsToPlugin,
  mergeTargetConfigurations,
  NoTargetsToMigrateError,
  processTargetOutputs,
  interpolate,
  resolveCommandSyntacticSugar,
  resolveNxTokensInOptions,
  toProjectRelativePath,
} from '@nx/devkit/internal';
import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  normalizePath,
  readNxJson,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { isAbsolute, relative as relativePath, resolve } from 'node:path';
import { basename, dirname, relative } from 'node:path/posix';
import { isDeepStrictEqual } from 'node:util';
import {
  createNodes,
  getLintCommand,
  getStandaloneSrcPath,
  lintReportOutput,
  type EslintPluginOptions,
} from '../../plugins/plugin';
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
  const nxJson = readNxJson(tree) ?? {};

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
          postTargetTransformer: (
            target,
            tree,
            projectDetails,
            inferredTargetConfiguration
          ) => {
            const projectNode = projectGraph.nodes[projectDetails.projectName];
            return postTargetTransformer(
              target,
              tree,
              projectDetails,
              inferredTargetConfiguration,
              getConvertedTarget(
                target,
                tree,
                projectDetails,
                inferredTargetConfiguration.name,
                nxJson,
                projectNode.data.tags
              ),
              // the migrator already dropped empty outputs and those equal to
              // the plugin's, so read the ones Nx resolved before the conversion
              projectNode.data.targets?.[inferredTargetConfiguration.name]
                ?.outputs
            );
          },
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

/**
 * The target Nx runs after the conversion: the plugin's command and cwd, then
 * the matching target defaults, then the converted project target.
 */
function getConvertedTarget(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  targetName: string,
  nxJson: NxJsonConfiguration,
  tags: string[] | undefined
): TargetConfiguration {
  const { root, projectName } = projectDetails;
  const pluginTarget: TargetConfiguration = {
    command: getLintCommand(root, getStandaloneSrcPath(root, tree.root)),
    options: { cwd: root },
  };
  let convertedTarget = resolveCommandSyntacticSugar(pluginTarget, root);
  for (const [, , { projects }] of createTargetDefaultsResults(
    { [root]: { root, targets: { [targetName]: pluginTarget } } },
    {
      [root]: {
        root,
        name: projectName,
        tags,
        targets: { [targetName]: target },
      },
    },
    nxJson,
    // lets `filter.plugin` entries match the plugin's target
    {
      [root]: {
        [`targets.${targetName}.command`]: [null, '@nx/eslint/plugin'],
      },
    }
  )) {
    convertedTarget = mergeTargetConfigurations(
      resolveCommandSyntacticSugar(projects[root].targets[targetName], root),
      convertedTarget
    );
  }
  return mergeTargetConfigurations(structuredClone(target), convertedTarget);
}

function postTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration,
  convertedTarget: TargetConfiguration,
  originalOutputs: string[] | undefined
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

  const cwd = resolveCwd(
    convertedTarget.options?.cwd,
    projectDetails,
    tree.root
  );
  const baseOptions = structuredClone(target.options ?? {});
  const reportPaths: string[] = [];

  if (target.options) {
    handlePropertiesInOptions(target.options, projectDetails, cwd, false);
    if (target.options['output-file']) {
      reportPaths.push(joinPathFragments(cwd, target.options['output-file']));
    }
  }

  for (const configurationName in convertedTarget.configurations) {
    const configurationCwd = resolveCwd(
      {
        ...convertedTarget.options,
        ...convertedTarget.configurations[configurationName],
      }.cwd,
      projectDetails,
      tree.root
    );
    const configuration = target.configurations?.[configurationName] ?? {};
    handlePropertiesInOptions(
      configuration,
      projectDetails,
      configurationCwd,
      true
    );
    // the base options were rebased onto the base cwd
    if (configurationCwd !== cwd) {
      const inheritedOptions = structuredClone(baseOptions);
      handlePropertiesInOptions(
        inheritedOptions,
        projectDetails,
        configurationCwd,
        false
      );
      for (const [option, value] of Object.entries(inheritedOptions)) {
        // only `convertedTarget` has the target defaults, but it keeps the
        // project's own options under the executor's names
        if (
          !(option in configuration) &&
          !(option in convertedTarget.configurations[configurationName]) &&
          !isDeepStrictEqual(value, target.options?.[option])
        ) {
          configuration[option] = value;
        }
      }
    }
    if (configuration['output-file']) {
      reportPaths.push(
        joinPathFragments(configurationCwd, configuration['output-file'])
      );
    }
    if (Object.keys(configuration).length !== 0) {
      target.configurations ??= {};
      target.configurations[configurationName] = configuration;
    }
  }

  if (target.configurations) {
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

  const isReportOutput = (output: string) => output.includes(reportOutputToken);

  if (target.outputs) {
    target.outputs = target.outputs.filter((output) => !isReportOutput(output));
    processTargetOutputs(target, [], inferredTargetConfiguration, {
      projectName: projectDetails.projectName,
      projectRoot: projectDetails.root,
    });
  }

  // added after processTargetOutputs, which would root them at the project,
  // in place of the plugin's report output it appends
  const declaredReportOutputs = (originalOutputs ?? []).filter(isReportOutput);
  if (declaredReportOutputs.length !== 0) {
    target.outputs = [
      ...(target.outputs ?? []).filter((output) => output !== lintReportOutput),
      ...declaredReportOutputs.map((output) =>
        output.replaceAll(reportOutputToken, lintReportOutput)
      ),
    ];
    if (
      isDeepStrictEqual(target.outputs, inferredTargetConfiguration.outputs)
    ) {
      delete target.outputs;
    }
  }

  // Nx fails a task whose output lands outside the workspace, so a target
  // writing its report there keeps only its own outputs
  if (
    declaredReportOutputs.length === 0 &&
    reportPaths.some((reportPath) => reportPath.startsWith('../'))
  ) {
    target.outputs = (target.outputs ?? []).filter(
      (output) => output !== lintReportOutput
    );
  }

  // the migrator drops an empty `outputs`, which would let the target inherit
  // the plugin's report output
  if (originalOutputs?.length === 0) {
    target.outputs = [];
  }

  return target;
}

const reportOutputToken = '{options.outputFile}';

function handlePropertiesInOptions(
  options: Record<string, any>,
  projectDetails: { projectName: string; root: string },
  cwd: string,
  isConfiguration: boolean
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
    // The executor treated an empty value as unset. ESLint rejects an empty
    // path, and run-commands skips `null`, which still overrides the base.
    if (!options[option]) {
      if (isConfiguration) {
        options[option] = null;
      } else {
        delete options[option];
      }
      continue;
    }
    options[option] = toCwdRelativePath(
      options[option],
      option,
      projectDetails,
      cwd
    );
  }

  if (Array.isArray(options.rulesdir)) {
    options.rulesdir = options.rulesdir.map((dir: string) =>
      toCwdRelativePath(dir, 'rulesdir', projectDetails, cwd)
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
      const formatPath = toCwdRelativePath(
        options.format,
        'format',
        projectDetails,
        cwd
      );
      options.format = /[\\/]/.test(formatPath)
        ? formatPath
        : `./${formatPath}`;
    }
  }

  for (const key in targetOptionsToCliMap) {
    if (options[key] || options[key] === null) {
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
 * The workspace-relative directory run-commands runs the converted target in,
 * resolved like its `calculateCwd`.
 */
function resolveCwd(
  cwd: string | undefined,
  projectDetails: { projectName: string; root: string },
  workspaceRoot: string
): string {
  if (!cwd) {
    return '.';
  }
  const resolvedCwd = resolveNxTokens(cwd, 'cwd', projectDetails);
  return (
    normalizePath(
      relativePath(workspaceRoot, resolve(workspaceRoot, resolvedCwd))
    ) || '.'
  );
}

/**
 * Rewrites a path the executor resolved from the workspace root so that ESLint
 * resolves it to the same location from `cwd`, where the converted target
 * runs it.
 */
function toCwdRelativePath(
  value: string,
  option: string,
  projectDetails: { projectName: string; root: string },
  cwd: string
): string {
  const resolvedValue = resolveNxTokens(value, option, projectDetails);
  // A relative path to an absolute location would depend on where the
  // workspace is on disk. The executor joined the output file onto the
  // workspace root, so its leading `/` stays inside the workspace.
  if (option !== 'outputFile' && isAbsolute(resolvedValue)) {
    return resolvedValue;
  }

  return toProjectRelativePath(joinPathFragments('.', resolvedValue), cwd);
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
