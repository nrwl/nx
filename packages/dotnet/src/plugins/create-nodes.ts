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
import {
  deriveGroupNameFromTarget,
  mergeTargetConfigurations,
} from '@nx/devkit/internal';

export type TargetConfigurationWithName = Partial<TargetConfiguration> & {
  /**
   * The name of the target. Defaults to the target type (e.g., 'build', 'test', etc.)
   */
  targetName?: string;
};

/**
 * Configuration for the test target, including the options that split it into
 * one task per test unit.
 */
export type TestTargetConfiguration = TargetConfigurationWithName & {
  /**
   * Name of the target that runs the project's tests split across many tasks.
   *
   * Leave unset (the default) and nothing is split — the project keeps only its
   * ordinary `test` target. Setting it turns on atomization for every project
   * this plugin registration matches, so to split a single project, register
   * `@nx/dotnet` a second time with an `include` pattern scoped to it.
   *
   * Requires Microsoft.Testing.Platform. Running the group needs Nx Cloud: Nx
   * refuses the parent target without it, because expanding into every task on
   * one machine is slower than not splitting at all. Individual tasks carry no
   * such restriction and run locally.
   */
  ciTargetName?: string;

  /**
   * Overrides the name of the target group these tasks are collapsed into in Nx
   * Console and the graph. Defaults to a name derived from `ciTargetName`
   * (`test-ci` becomes `TEST (CI)`).
   */
  ciGroupName?: string;

  /**
   * Whether each task runs one test class or one test method. Defaults to
   * `'class'`.
   *
   * `'method'` is worth opting into when each test method carries its own
   * expensive fixture — spinning up a distributed application, a database, a
   * browser — because then grouping methods into one task saves no setup work
   * and only serializes tests that could have run on separate agents. For
   * ordinary suites it multiplies the target count for no gain, since process
   * startup dominates a fast test.
   *
   * `'method'` currently requires MSTest; see the plugin docs.
   */
  ciSplitBy?: 'class' | 'method';
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
   * Use `targetName` to rename the target, `ciTargetName` to additionally split
   * the tests across one task per test unit, and provide additional
   * options/configurations to merge with the generated target.
   */
  test?: TestTargetConfiguration | false;
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
 * Removes an atomized target group whose non-split target is being disabled.
 *
 * Without this, disabling `test` would leave its `test-ci` parent and every
 * `test-ci--*` leaf behind, all pointing at a target that no longer exists.
 * The group is located by its `nonAtomizedTarget` back-reference rather than by
 * name, since the disabling option carries no `ciTargetName` to look up.
 */
function removeAtomizedTargetsFor(
  targets: Record<string, TargetConfiguration>,
  metadata: ProjectConfiguration['metadata'],
  nonAtomizedTargetName: string
): ProjectConfiguration['metadata'] {
  const parentName = Object.keys(targets).find(
    (name) =>
      targets[name].metadata?.nonAtomizedTarget === nonAtomizedTargetName
  );

  if (!parentName) {
    return metadata;
  }

  for (const name of Object.keys(targets)) {
    if (name === parentName || name.startsWith(`${parentName}--`)) {
      delete targets[name];
    }
  }

  if (!metadata?.targetGroups) {
    return metadata;
  }

  const targetGroups = Object.fromEntries(
    Object.entries(metadata.targetGroups)
      .map(
        ([group, names]) =>
          [group, names.filter((name) => name in targets)] as const
      )
      .filter(([, names]) => names.length > 0)
  );

  return { ...metadata, targetGroups };
}

/**
 * Merge user-specified target configurations with the generated targets from the analyzer
 */
export function mergeUserTargetConfigurations(
  node: ProjectConfiguration,
  options: DotNetPluginOptions
): ProjectConfiguration {
  if (!node.targets || !options) {
    return node;
  }

  const targetMappings: Array<{
    targetOption: TestTargetConfiguration | false | undefined;
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
  let mergedMetadata = node.metadata;

  for (const { targetOption, defaultTargetName } of targetMappings) {
    // Disabled target from user configuration
    if (targetOption === false) {
      mergedMetadata = removeAtomizedTargetsFor(
        mergedTargets,
        mergedMetadata,
        defaultTargetName
      );
      delete mergedTargets[defaultTargetName];
      continue;
    }

    // Use empty object as default when option is not provided.
    //
    // The ci* keys configure how the analyzer generates targets rather than
    // being target configuration themselves, so they are pulled out here
    // alongside targetName — otherwise they would be merged onto the generated
    // target as junk properties.
    const {
      targetName,
      ciTargetName: _ciTargetName,
      ciGroupName: _ciGroupName,
      ciSplitBy: _ciSplitBy,
      ...userSpecifiedConfig
    } = targetOption ?? {};
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
  }

  return {
    ...node,
    targets: mergedTargets,
    ...(mergedMetadata ? { metadata: mergedMetadata } : {}),
  };
}

export const createNodes: CreateNodes<DotNetPluginOptions> = [
  dotnetProjectGlob,
  async (configFilePaths, options, context) => {
    // Analyze all projects - the C# analyzer builds the complete Nx structure
    try {
      // Normalize options to handle undefined (when plugin is registered as string)
      const normalizedOptions = options ?? {};

      const testOptions =
        normalizedOptions.test === false ? undefined : normalizedOptions.test;
      // Only meaningful when the test target itself is enabled; splitting a
      // target that will be deleted would generate targets referring to it.
      const ciTargetName = testOptions?.ciTargetName;

      // Extract target names from new format and create options for analyzer
      const analyzerOptions = {
        // Derived here rather than in the analyzer so there is one
        // implementation of the naming convention shared with every other Nx
        // plugin that splits tests.
        testCiTargetName: ciTargetName,
        testCiGroupName: ciTargetName
          ? (testOptions?.ciGroupName ??
            deriveGroupNameFromTarget(ciTargetName))
          : undefined,
        testCiSplitBy: ciTargetName
          ? (testOptions?.ciSplitBy ?? 'class')
          : undefined,
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
