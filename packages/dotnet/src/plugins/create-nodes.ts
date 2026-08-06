import {
  CreateNodes,
  logger,
  ProjectConfiguration,
  ProjectGraphExternalNode,
  TargetConfiguration,
} from '@nx/devkit';
import {
  analyzeProjects,
  isAnalysisErrorResult,
  ResolvedPackage,
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

  for (const { targetOption, defaultTargetName } of targetMappings) {
    // Disabled target from user configuration
    if (targetOption === false) {
      delete mergedTargets[defaultTargetName];
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
  }

  return {
    ...node,
    targets: mergedTargets,
  };
}

/**
 * Kept in sync with `TargetBuilder.NuGetExternalNodePrefix` in the analyzer.
 */
export const NUGET_EXTERNAL_NODE_PREFIX = 'nuget:';

/**
 * The version is part of the node name so CPM scopes pinning the same package to different
 * versions produce distinct nodes, as npm does with `npm:pkg@version`.
 */
export function nugetExternalNodeName(pkg: ResolvedPackage): string {
  return `${NUGET_EXTERNAL_NODE_PREFIX}${pkg.id}@${pkg.version}`;
}

/**
 * Builds one external node per (package, version) referenced anywhere in the workspace.
 */
function createNuGetExternalNodes(
  packagesByRoot: Record<string, ResolvedPackage[]> | undefined
): Record<string, ProjectGraphExternalNode> {
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};

  for (const packages of Object.values(packagesByRoot ?? {})) {
    for (const pkg of packages) {
      const name = nugetExternalNodeName(pkg);
      externalNodes[name] ??= {
        type: 'nuget',
        name,
        data: {
          packageName: pkg.id,
          version: pkg.version,
        },
      };
    }
  }

  return externalNodes;
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
      };

      const result = await analyzeProjects(
        [...configFilePaths],
        analyzerOptions
      );

      if (isAnalysisErrorResult(result)) {
        throw result.error;
      }

      const { nodesByFile, packagesByRoot } = result;

      const externalNodes = createNuGetExternalNodes(packagesByRoot);

      // Return array of [configFile, result] tuples. Every tuple's externalNodes merge into
      // the same graph, so the map is attached to the first tuple only — repeating it would
      // inflate the serialized worker payload proportionally to the number of project files.
      return configFilePaths.map((configFile, index) => {
        const tupleExternalNodes = index === 0 ? { externalNodes } : undefined;

        const node = nodesByFile[configFile];
        if (!node) {
          // Directory.Build.* / Directory.Solution.* files contribute no projects of
          // their own; returning an empty config is the conventional "skip" response.
          return [configFile, { ...tupleExternalNodes }];
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
            ...tupleExternalNodes,
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
