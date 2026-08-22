import {
  CreateNodes,
  logger,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import {
  analyzeProjects,
  isAnalysisErrorResult,
} from '../analyzer/analyzer-client';
import { mergeTargetConfigurations } from '@nx/devkit/internal';

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
 *             "additionalOption": "value"
 *           },
 *           "configurations": {
 *             "production": {
 *               "optimization": true
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
   * Configuration for the restore target.
   * Use `targetName` to rename the target, and provide additional options/configurations to merge with the generated target.
   */
  restore?: TargetConfigurationWithName | false;
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
  /**
   * When enabled, multi-targeted projects (those declaring `<TargetFrameworks>`)
   * additionally get per-target-framework build variants alongside the
   * unqualified targets — for example `build-net10.0-ios` and
   * `build-net10.0-ios-release`. Each variant passes `--framework` to the .NET
   * CLI and scopes its outputs and cache identity to that framework.
   *
   * Variants are self-contained: they do not depend on the unqualified build,
   * so building one framework never triggers an all-framework build of the
   * project or its dependencies. Any configuration you set on the `build`
   * target is applied to its variants too, and disabling `build` removes them.
   *
   * This is opt-in because it expands the task graph, and it never changes the
   * unqualified targets. Single-targeted projects are unaffected.
   *
   * @default false
   */
  frameworkVariants?: boolean;
}

// MSBuild auto-imports Directory.Build.props/.targets from each ancestor of a project file,
// reads Directory.Build.rsp from ancestors during CLI builds, applies Directory.Solution.*
// when building a .sln, and reads Directory.Packages.props from the nearest ancestor when
// Central Package Management is in use. Matching them here causes createNodesV2 to re-run
// (and the analyzer's cache to invalidate) when any of them change, and gives us the file
// list to hand to the analyzer so it can declare per-project ancestor inputs.
// The analyzer partitions matched paths into project vs directory files by filename, so we
// don't have to repeat that classification on this side.
const dotnetProjectGlob =
  '**/{*.{csproj,fsproj,vbproj},Directory.Build.{props,targets,rsp},Directory.Solution.{props,targets},Directory.Packages.props}';

/**
 * Merge user-specified target configurations with the generated targets from the analyzer
 */
function mergeUserTargetConfigurations(
  node: ProjectConfiguration,
  options: DotNetPluginOptions
): ProjectConfiguration {
  if (!node.targets || !options) {
    return node;
  }

  const targetMappings: Array<{
    targetOption: TargetConfigurationWithName | false | undefined;
    defaultTargetName: string;
  }> = [
    { targetOption: options.build, defaultTargetName: 'build' },
    { targetOption: options.test, defaultTargetName: 'test' },
    { targetOption: options.clean, defaultTargetName: 'clean' },
    { targetOption: options.restore, defaultTargetName: 'restore' },
    { targetOption: options.publish, defaultTargetName: 'publish' },
    { targetOption: options.pack, defaultTargetName: 'pack' },
    { targetOption: options.watch, defaultTargetName: 'watch' },
    { targetOption: options.run, defaultTargetName: 'run' },
  ];

  const mergedTargets = { ...node.targets };

  // A framework variant's metadata records the unqualified target it derives
  // from (e.g. `build`), so the same user configuration can be applied to the
  // variants and they can be removed alongside a disabled base target.
  const variantsOf = (baseName: string): string[] =>
    Object.keys(mergedTargets).filter(
      (name) =>
        (
          mergedTargets[name]?.metadata as
            | { frameworkVariantOf?: string }
            | undefined
        )?.frameworkVariantOf === baseName
    );

  for (const { targetOption, defaultTargetName } of targetMappings) {
    // Disabled target from user configuration
    if (targetOption === false) {
      delete mergedTargets[defaultTargetName];
      for (const variantName of variantsOf(defaultTargetName)) {
        delete mergedTargets[variantName];
      }
      continue;
    }

    // Use empty object as default when option is not provided
    const { targetName, ...userSpecifiedConfig } = targetOption ?? {};
    const actualTargetName = targetName ?? defaultTargetName;

    // Find the generated target - it might be under the default name or the user-specified name
    const generatedTarget =
      mergedTargets[actualTargetName] ?? mergedTargets[defaultTargetName];

    if (!generatedTarget) {
      continue;
    }

    const hasUserConfig = Object.keys(userSpecifiedConfig).length > 0;
    const isRenamed = actualTargetName !== defaultTargetName;

    // Merge user config with generated target if user config is provided
    if (hasUserConfig) {
      mergedTargets[actualTargetName] = mergeTargetConfigurations(
        userSpecifiedConfig as TargetConfiguration,
        generatedTarget
      );
    } else if (isRenamed) {
      // If only renaming (no config to merge), just copy the target to the new name
      mergedTargets[actualTargetName] = { ...generatedTarget };
    }

    // If target was renamed, remove the old target name
    if (isRenamed && mergedTargets[defaultTargetName]) {
      delete mergedTargets[defaultTargetName];
    }

    // Keep the framework variants consistent with the base target: apply the
    // same user configuration to each variant. The analyzer already names and
    // stamps variants with the configured (possibly renamed) target name.
    if (hasUserConfig) {
      for (const variantName of variantsOf(actualTargetName)) {
        mergedTargets[variantName] = mergeTargetConfigurations(
          userSpecifiedConfig as TargetConfiguration,
          mergedTargets[variantName]
        );
      }
    }
  }

  return {
    ...node,
    targets: mergedTargets,
  };
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
          (normalizedOptions.restore && normalizedOptions.restore.targetName) ||
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
        // Framework variants derive from the build target, so a disabled build
        // means no variants to generate.
        frameworkVariants:
          (normalizedOptions.frameworkVariants ?? false) &&
          normalizedOptions.build !== false,
      };

      const result = await analyzeProjects(
        [...configFilePaths],
        analyzerOptions
      );

      if (isAnalysisErrorResult(result)) {
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
