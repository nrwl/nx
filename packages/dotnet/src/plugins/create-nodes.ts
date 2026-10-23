import {
  CreateNodes,
  logger,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import {
  ANALYZER_CANCELLED_MESSAGE,
  analyzeProjects,
  isAnalysisErrorResult,
} from '../analyzer/analyzer-client';
import { mergeTargetConfigurations } from '@nx/devkit/internal';
import runCommandsSchema from 'nx/src/executors/run-commands/schema.json';
import { serializeOverridesIntoCommandLine } from 'nx/src/utils/serialize-overrides-into-command-line';

const executionOptions = new Set([
  ...Object.keys(runCommandsSchema.properties),
  '__unparsed__',
  'verbose',
  'no-color',
  'no-parallel',
]);

export type TargetConfigurationWithName = Partial<TargetConfiguration> & {
  /**
   * The name of the target. Defaults to the target type (e.g., 'build', 'test', etc.)
   */
  targetName?: string;
};

/**
 * Configuration options for the @nx/dotnet plugin.
 *
 * @example
 * ```typescript
 * // In nx.json:
 * {
 *   "plugins": [
 *     {
 *       "plugin": "@nx/dotnet",
 *       "options": {
 *         "build": {
 *           "targetName": "compile",
 *           "options": {
 *             "args": ["--verbosity", "quiet"]
 *           },
 *           "configurations": {
 *             "release": {
 *               "args": ["-p:Optimize=true"]
 *             }
 *           }
 *         },
 *         "test": {
 *           "targetName": "unit-test",
 *           "dependsOn": ["build"]
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 */
export interface DotNetPluginOptions {
  /**
   * Infer per-TFM build targets for multi-targeted projects. Defaults to true.
   */
  tfmVariants?: boolean;
  /**
   * Configuration for the build target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  build?: TargetConfigurationWithName | false;
  /**
   * Configuration for the test target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  test?: TargetConfigurationWithName | false;
  /**
   * Configuration for the clean target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  clean?: TargetConfigurationWithName | false;
  /**
   * Configuration for the restore target, which is not created by default.
   * Set to `true`, or provide a configuration object, to opt in. `restore` is
   * neither cached nor part of the task chain, so running it through Nx behaves
   * the same as running `dotnet restore` directly.
   */
  restore?: TargetConfigurationWithName | boolean;
  /**
   * Configuration for the publish target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  publish?: TargetConfigurationWithName | false;
  /**
   * Configuration for the pack target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  pack?: TargetConfigurationWithName | false;
  /**
   * Configuration for the watch target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  watch?: TargetConfigurationWithName | false;
  /**
   * Configuration for the run target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  run?: TargetConfigurationWithName | false;
}

// Every file matched here re-runs createNodes and enters the analyzer's cache key when
// it changes. Project files and the ancestor-scoped files MSBuild, the SDK resolver, NuGet
// and the analyzers read on their own (Directory.*, global.json, nuget.config,
// .editorconfig) are also handed to the analyzer so it can declare per-project inputs.
// Any other .props/.targets is matched only so an edit to a file a project imports by
// name invalidates the graph; the analyzer discovers which ones matter by evaluating and
// reports them back as evaluationInputs, which covers imports with other extensions.
// The analyzer partitions matched paths by filename, so nothing is classified here.
const dotnetProjectGlob =
  '**/{*.{csproj,fsproj,vbproj,props,targets,cs,fs,vb,resx},Directory.Build.rsp,global.json,nuget.config,NuGet.config,NuGet.Config,.editorconfig}';

/**
 * Merge user-specified target configurations with the generated targets from the analyzer
 */
export function mergeUserTargetConfigurations(
  node: ProjectConfiguration,
  options: DotNetPluginOptions | undefined
): ProjectConfiguration {
  if (!node.targets) {
    return node;
  }

  const pluginOptions = options ?? {};
  const targetMappings: Array<{
    targetOption: TargetConfigurationWithName | boolean | undefined;
    defaultTargetName: string;
    optIn?: boolean;
  }> = [
    { targetOption: pluginOptions.build, defaultTargetName: 'build' },
    { targetOption: pluginOptions.test, defaultTargetName: 'test' },
    { targetOption: pluginOptions.clean, defaultTargetName: 'clean' },
    {
      targetOption: pluginOptions.restore,
      defaultTargetName: 'restore',
      optIn: true,
    },
    { targetOption: pluginOptions.publish, defaultTargetName: 'publish' },
    { targetOption: pluginOptions.pack, defaultTargetName: 'pack' },
    { targetOption: pluginOptions.watch, defaultTargetName: 'watch' },
    { targetOption: pluginOptions.run, defaultTargetName: 'run' },
  ];

  const mergedTargets = { ...node.targets };

  for (const { targetOption, defaultTargetName, optIn } of targetMappings) {
    if (targetOption === false || (optIn && targetOption === undefined)) {
      for (const [name, target] of Object.entries(mergedTargets)) {
        if (
          name === defaultTargetName ||
          name === `${defaultTargetName}:release` ||
          target.metadata?.variantOf === defaultTargetName
        ) {
          delete mergedTargets[name];
          removeFromDependsOn(mergedTargets, name);
        }
      }
      continue;
    }

    // `true` opts a target in and carries no configuration of its own.
    const { targetName, ...userSpecifiedConfig } =
      targetOption === true ? {} : (targetOption ?? {});
    const actualTargetName = targetName ?? defaultTargetName;

    // Find the generated target - it might be under the default name or the user-specified name
    const generatedTarget =
      mergedTargets[actualTargetName] ?? mergedTargets[defaultTargetName];

    if (!generatedTarget) {
      continue;
    }

    const variants = Object.entries(mergedTargets).filter(
      ([, target]) =>
        target.metadata?.variantOf === actualTargetName ||
        target.metadata?.variantOf === defaultTargetName
    );
    if (variants.length > 0) {
      for (const [name, variant] of variants) {
        mergedTargets[name] = mergeVariantTarget(
          userSpecifiedConfig,
          variant,
          name
        );
      }
    }

    const hasUserConfig = Object.keys(userSpecifiedConfig).length > 0;
    const isRenamed = actualTargetName !== defaultTargetName;

    // Merge user config with generated target if user config is provided
    if (
      hasUserConfig &&
      generatedTarget.executor === 'nx:noop' &&
      variants.length > 0
    ) {
      mergedTargets[actualTargetName] = {
        ...generatedTarget,
        metadata: {
          ...generatedTarget.metadata,
          ...userSpecifiedConfig.metadata,
        },
        dependsOn: [
          ...(generatedTarget.dependsOn ?? []),
          ...(userSpecifiedConfig.dependsOn ?? []),
        ],
        defaultConfiguration:
          userSpecifiedConfig.defaultConfiguration ??
          generatedTarget.defaultConfiguration,
      };
    } else if (hasUserConfig) {
      mergedTargets[actualTargetName] = generatedTarget.command?.includes(
        '{args.nxArgs}'
      )
        ? mergeVariantTarget(
            userSpecifiedConfig,
            generatedTarget,
            actualTargetName
          )
        : mergeCommandTarget(userSpecifiedConfig, generatedTarget);
      if (defaultTargetName === 'publish' && generatedTarget.cache === false) {
        mergedTargets[actualTargetName].cache = false;
        mergedTargets[actualTargetName].outputs = generatedTarget.outputs;
      }
    } else if (isRenamed) {
      // If only renaming (no config to merge), just copy the target to the new name
      mergedTargets[actualTargetName] = { ...generatedTarget };
    }

    // If target was renamed, remove the old target name
    if (isRenamed && mergedTargets[defaultTargetName]) {
      delete mergedTargets[defaultTargetName];
    }
  }

  return {
    ...node,
    targets: mergedTargets,
    ...(node.metadata?.targetGroups && {
      metadata: {
        ...node.metadata,
        targetGroups: Object.fromEntries(
          Object.entries(node.metadata.targetGroups).map(([group, names]) => [
            group,
            names.filter((name) => mergedTargets[name]),
          ])
        ),
      },
    }),
  };
}

function argsText(args: unknown, name: string): string {
  if (args === undefined) return '';
  if (typeof args === 'string') return args;
  if (Array.isArray(args) && args.every((arg) => typeof arg === 'string'))
    return args.join(' ');
  throw new Error(
    `Expected options.args for .NET target '${name}' to be a string or string array.`
  );
}

function mergeCommandTarget(
  user: Partial<TargetConfiguration>,
  generated: TargetConfiguration
): TargetConfiguration {
  const result = mergeTargetConfigurations(user, generated);
  const baseArgs = argsText(user.options?.args, generated.command ?? '');
  if (
    generated.options?.args !== undefined &&
    user.options?.args !== undefined
  ) {
    result.options = {
      ...result.options,
      args: [
        argsText(generated.options.args, generated.command ?? ''),
        baseArgs,
      ].filter(Boolean),
    };
  }
  for (const [name, configuration] of Object.entries(
    generated.configurations ?? {}
  )) {
    if (
      configuration.args !== undefined &&
      (baseArgs || user.configurations?.[name]?.args !== undefined)
    ) {
      result.configurations = {
        ...result.configurations,
        [name]: {
          ...result.configurations?.[name],
          args: [
            argsText(configuration.args, name),
            baseArgs,
            argsText(user.configurations?.[name]?.args, name),
          ].filter(Boolean),
        },
      };
    }
  }
  return result;
}

function mergeVariantTarget(
  user: Partial<TargetConfiguration>,
  variant: TargetConfiguration,
  name: string
): TargetConfiguration {
  if (
    user.outputs !== undefined ||
    (variant.parallelism === false && user.parallelism === true) ||
    (variant.cache === false && user.cache === true)
  ) {
    throw new Error(
      `Cannot override evaluated output ownership or execution/cache safety of .NET variant '${name}'. Set tfmVariants: false for a custom build target.`
    );
  }
  if (
    (user.command && user.command !== variant.command) ||
    (user.executor && user.executor !== 'nx:run-commands')
  ) {
    throw new Error(
      `Cannot replace the command or executor of .NET variant '${name}'. Set tfmVariants: false to use a custom build command.`
    );
  }
  const validate = (options: Record<string, unknown> | undefined): string => {
    const extraOptions = Object.fromEntries(
      Object.entries(options ?? {}).filter(
        ([key]) => !executionOptions.has(key)
      )
    );
    const args = [
      argsText(options?.args, name),
      ...serializeOverridesIntoCommandLine(extraOptions),
    ]
      .filter(Boolean)
      .join(' ');
    if (
      /--(?:nx-*Args|nx-*Outputs|forward-*All-*Args|__unparsed__)(?:["'=.\s:]|$)|(?:^|\s)@|(?:^|\s)(?:--(?:framework|runtime|configuration|output|artifacts-path|no-dependencies|os|arch)|-[frcoa])(?:[=\s:]|$)|(?:^|\s)(?:[-/](?:p|property):|--property[=:\s])[^\s]*(?:TargetFrameworks?|RuntimeIdentifiers?|Configuration|OutputPath|OutDir|PublishDir|IntermediateOutputPath|ArtifactsPath|UseArtifactsOutput|BaseOutputPath|BaseIntermediateOutputPath|AppendTargetFrameworkToOutputPath|AppendRuntimeIdentifierToOutputPath)\s*=/i.test(
        args
      ) ||
      Object.keys(options ?? {}).some((key) =>
        /^(?:nxArgs|nxOutputs|__unparsed__|framework|runtime|configuration|output|artifacts-path|commands?|cwd|forwardAllArgs|os|arch)$/i.test(
          key
        )
      )
    ) {
      throw new Error(
        `Cannot override framework, runtime, configuration, command, or output ownership of .NET variant '${name}'. Use its Nx configuration, or set tfmVariants: false.`
      );
    }
    return args;
  };
  const baseArgs = validate(user.options);
  const generatedConfigurations = variant.configurations ?? {};
  if (
    user.defaultConfiguration &&
    !generatedConfigurations[user.defaultConfiguration]
  ) {
    throw new Error(
      `Unsupported default configuration '${user.defaultConfiguration}' for .NET variant '${name}'. Only evaluated debug/release configurations are supported.`
    );
  }
  const configurations: NonNullable<TargetConfiguration['configurations']> = {};
  for (const [configuration, config] of Object.entries(
    user.configurations ?? {}
  )) {
    if (!generatedConfigurations[configuration]) {
      throw new Error(
        `Unsupported configuration '${configuration}' for .NET variant '${name}'. Only evaluated debug/release configurations are supported; set tfmVariants: false for custom configurations.`
      );
    }
    validate(config);
  }
  for (const [configuration, generated] of Object.entries(
    generatedConfigurations
  )) {
    const custom = user.configurations?.[configuration] ?? {};
    const customArgs = validate(custom);
    configurations[configuration] = {
      ...custom,
      ...generated,
      args: [...(generated.args ?? []), baseArgs, customArgs].filter(Boolean),
      nxArgs: [generated.nxArgs, baseArgs, customArgs]
        .filter(Boolean)
        .join(' '),
    };
  }
  return {
    ...mergeTargetConfigurations(user, variant),
    command: variant.command,
    executor: variant.executor,
    dependsOn: [
      ...(variant.dependsOn ?? []),
      ...(user.dependsOn ?? []).filter((dependency) => {
        const owner: unknown = variant.metadata?.variantOf;
        if (typeof owner !== 'string') return true;
        return typeof dependency === 'string'
          ? dependency !== `^${owner}` && dependency !== '^build'
          : !(
              dependency.dependencies &&
              (dependency.target === owner || dependency.target === 'build')
            );
      }),
    ],
    inputs: [...(variant.inputs ?? []), ...(user.inputs ?? [])],
    outputs: variant.outputs,
    parallelism: variant.parallelism,
    cache: variant.cache === false ? false : (user.cache ?? variant.cache),
    options: { ...user.options, ...variant.options },
    configurations,
    metadata: { ...user.metadata, ...variant.metadata },
  };
}

/**
 * Drops a removed target from the remaining targets' `dependsOn`. `watch`
 * depends on `restore`, and Nx silently skips a dependency naming a target the
 * project does not have, so a leftover entry is inert but still advertises a
 * target that no longer exists.
 */
function removeFromDependsOn(
  targets: Record<string, TargetConfiguration>,
  removed: string
): void {
  for (const [name, target] of Object.entries(targets)) {
    if (!target.dependsOn) continue;

    const dependsOn = target.dependsOn.filter((dependency) =>
      typeof dependency === 'string'
        ? dependency !== removed && dependency !== `^${removed}`
        : dependency.target !== removed
    );
    if (dependsOn.length !== target.dependsOn.length) {
      targets[name] = { ...target, dependsOn };
    }
  }
}

export const createNodes: CreateNodes<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePaths, options, context) => {
    // Analyze all projects - the C# analyzer builds the complete Nx structure
    try {
      // Normalize options to handle undefined (when plugin is registered as string)
      const normalizedOptions = options ?? {};

      // Extract target names from new format and create options for analyzer
      const analyzerOptions = {
        tfmVariants:
          normalizedOptions.build !== false &&
          normalizedOptions.tfmVariants !== false,
        buildTargetName:
          (normalizedOptions.build && normalizedOptions.build.targetName) ||
          'build',
        testTargetName:
          (normalizedOptions.test && normalizedOptions.test.targetName) ||
          'test',
        cleanTargetName:
          (normalizedOptions.clean && normalizedOptions.clean.targetName) ||
          'clean',
        restoreTargetName:
          (typeof normalizedOptions.restore === 'object' &&
            normalizedOptions.restore.targetName) ||
          'restore',
        publishTargetName:
          (normalizedOptions.publish && normalizedOptions.publish.targetName) ||
          'publish',
        packTargetName:
          (normalizedOptions.pack && normalizedOptions.pack.targetName) ||
          'pack',
        watchTargetName:
          (normalizedOptions.watch && normalizedOptions.watch.targetName) ||
          'watch',
        runTargetName:
          (normalizedOptions.run && normalizedOptions.run.targetName) || 'run',
      };

      const result = await analyzeProjects(
        [...configFilePaths],
        analyzerOptions
      );

      if (isAnalysisErrorResult(result)) {
        if (result.error.message === ANALYZER_CANCELLED_MESSAGE) {
          // Superseded by a newer analysis — silently return empty rather than
          // failing the user's command with an internal sentinel.
          // Safe only because the daemon drops this compute at its
          // `stalePostCreateNodes` guard before createDependencies runs; that one
          // would throw on the cache this run deliberately did not write.
          return [];
        }
        throw result.error;
      }

      const { nodesByFile } = result;

      // Return array of [configFile, result] tuples
      return configFilePaths.map((configFile) => {
        const node = nodesByFile[configFile];
        if (!node) {
          // Directory.Build.* / Directory.Solution.* files contribute no projects of
          // their own; returning an empty config is the conventional "skip" response.
          return [configFile, {}];
        }

        // Merge user-specified target configurations with generated targets. The analyzer
        // has already written the Directory.* inputs onto each cacheable target's Inputs.
        const mergedNode = mergeUserTargetConfigurations(
          node,
          normalizedOptions
        );

        return [
          configFile,
          {
            projects: {
              [mergedNode.root]: mergedNode,
            },
          },
        ];
      });
    } catch (err) {
      const error = err as Error;
      logger.error(`Failed to run MSBuild analyzer: ${error.message}`);
      throw error;
    }
  },
];

/**
 * @deprecated Use {@link createNodes} instead. This will be removed in Nx 24.
 */
export const createNodesV2 = createNodes;
