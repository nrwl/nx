import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createRootMap,
  mergeProjectConfigurationIntoRootMap,
  ProjectNodesManager,
} from './project-configuration/project-nodes-manager';
import { validateAndNormalizeProjectRootMap } from './project-configuration/target-normalization';

import { minimatch } from 'minimatch';
import { performance } from 'perf_hooks';

import { DelayedSpinner } from '../../utils/delayed-spinner';
import {
  AggregateCreateNodesError,
  formatAggregateCreateNodesError,
  isAggregateCreateNodesError,
  isMultipleProjectsWithSameNameError,
  isProjectsWithNoNameError,
  isWorkspaceValidityError,
  MergeNodesError,
  MultipleProjectsWithSameNameError,
  ProjectConfigurationsError,
  ProjectsWithNoNameError,
  WorkspaceValidityError,
} from '../error-types';
import type { LoadedNxPlugin } from '../plugins/loaded-nx-plugin';
import { CreateNodesResult } from '../plugins/public-api';

import type {
  ConfigurationSourceMaps,
  SourceInformation,
} from './project-configuration/source-maps';

import { createTargetDefaultsResults } from './project-configuration-utils/target-defaults';

export { mergeTargetConfigurations } from './project-configuration/target-merging';
export { readTargetDefaultsForTarget } from './project-configuration-utils/target-defaults';

export type ConfigurationResult = {
  /**
   * A map of project configurations, keyed by project root.
   */
  projects: {
    [projectRoot: string]: ProjectConfiguration;
  };

  /**
   * Node Name -> Node info
   */
  externalNodes: Record<string, ProjectGraphExternalNode>;

  /**
   * Project Root -> Project Name
   */
  projectRootMap: Record<string, string>;

  sourceMaps: ConfigurationSourceMaps;

  /**
   * The list of files that were used to create project configurations
   */
  matchingProjectFiles: string[];
};

/**
 * Transforms a list of project paths into a map of project configurations.
 *
 * Plugins are run in parallel, then results are merged in a single ordered pass:
 *   specified plugins → synthetic target defaults → default plugins
 *
 * This ordering ensures '...' spread tokens in default plugin configs
 * (project.json, package.json) expand against accumulated values from
 * specified plugins and target defaults.
 *
 * @param root The workspace root
 * @param nxJson The NxJson configuration
 * @param projectFiles Plugin config files, separated by plugin set
 * @param plugins The plugins separated into specified and default sets
 */
export async function createProjectConfigurationsWithPlugins(
  root: string = workspaceRoot,
  nxJson: NxJsonConfiguration,
  projectFiles: {
    specifiedPluginFiles: string[][];
    defaultPluginFiles: string[][];
  },
  plugins: {
    specifiedPlugins: LoadedNxPlugin[];
    defaultPlugins: LoadedNxPlugin[];
  }
): Promise<ConfigurationResult> {
  performance.mark('build-project-configs:start');

  let spinner: DelayedSpinner;
  const inProgressPlugins = new Set<string>();

  function updateSpinner() {
    if (!spinner || inProgressPlugins.size === 0) {
      return;
    }

    if (inProgressPlugins.size === 1) {
      spinner.setMessage(
        `Creating project graph nodes with ${
          inProgressPlugins.values().next().value
        }`
      );
    } else if (process.env.NX_VERBOSE_LOGGING === 'true') {
      spinner.setMessage(
        [
          `Creating project graph nodes with ${inProgressPlugins.size} plugins`,
          ...Array.from(inProgressPlugins).map((p) => `  - ${p}`),
        ].join('\n')
      );
    } else {
      spinner.setMessage(
        `Creating project graph nodes with ${inProgressPlugins.size} plugins`
      );
    }
  }

  const specifiedCreateNodesPlugins = plugins.specifiedPlugins.filter(
    (plugin) => plugin.createNodes?.[0]
  );
  const defaultCreateNodesPlugins = plugins.defaultPlugins.filter(
    (plugin) => plugin.createNodes?.[0]
  );
  const allCreateNodesPlugins = [
    ...specifiedCreateNodesPlugins,
    ...defaultCreateNodesPlugins,
  ];
  const allProjectFiles = [
    ...projectFiles.specifiedPluginFiles,
    ...projectFiles.defaultPluginFiles,
  ];
  const specifiedCount = specifiedCreateNodesPlugins.length;

  spinner = new DelayedSpinner(
    `Creating project graph nodes with ${allCreateNodesPlugins.length} plugins`
  );

  const results: Promise<
    (readonly [
      plugin: string,
      file: string,
      result: CreateNodesResult,
      index?: number,
    ])[]
  >[] = [];
  const errors: Array<
    | AggregateCreateNodesError
    | MergeNodesError
    | ProjectsWithNoNameError
    | MultipleProjectsWithSameNameError
    | WorkspaceValidityError
  > = [];

  // We iterate over plugins first - this ensures that plugins specified first take precedence.
  for (const [
    index,
    {
      index: pluginIndex,
      createNodes: createNodesTuple,
      include,
      exclude,
      name: pluginName,
    },
  ] of allCreateNodesPlugins.entries()) {
    const [pattern, createNodes] = createNodesTuple;

    const matchingConfigFiles: string[] = findMatchingConfigFiles(
      allProjectFiles[index],
      pattern,
      include,
      exclude
    );

    inProgressPlugins.add(pluginName);
    let r = createNodes(matchingConfigFiles, {
      nxJsonConfiguration: nxJson,
      workspaceRoot: root,
    })
      .catch((e: Error) => {
        const error: AggregateCreateNodesError = isAggregateCreateNodesError(e)
          ? // This is an expected error if something goes wrong while processing files.
            e
          : // This represents a single plugin erroring out with a hard error.
            new AggregateCreateNodesError([[null, e]], []);
        if (pluginIndex !== undefined) {
          error.pluginIndex = pluginIndex;
        }
        formatAggregateCreateNodesError(error, pluginName);
        // This represents a single plugin erroring out with a hard error.
        errors.push(error);
        // The plugin didn't return partial results, so we return an empty array.
        return error.partialResults.map(
          (r) => [pluginName, r[0], r[1], index] as const
        );
      })
      .finally(() => {
        inProgressPlugins.delete(pluginName);
        updateSpinner();
      });

    results.push(r);
  }

  return Promise.all(results).then((results) => {
    spinner?.cleanup();

    // Split results into specified and default plugin sets
    const specifiedResults = results.slice(0, specifiedCount);
    const defaultResults = results.slice(specifiedCount);

    const { projectRootMap, externalNodes, rootMap, configurationSourceMaps } =
      mergeCreateNodesResults(
        specifiedResults,
        defaultResults,
        nxJson,
        root,
        errors
      );

    performance.mark('build-project-configs:end');
    performance.measure(
      'build-project-configs',
      'build-project-configs:start',
      'build-project-configs:end'
    );

    const allProjectFilesFlat = [
      ...projectFiles.specifiedPluginFiles.flat(),
      ...projectFiles.defaultPluginFiles.flat(),
    ];

    if (errors.length === 0) {
      return {
        projects: projectRootMap,
        externalNodes,
        projectRootMap: rootMap,
        sourceMaps: configurationSourceMaps,
        matchingProjectFiles: allProjectFilesFlat,
      };
    } else {
      throw new ProjectConfigurationsError(errors, {
        projects: projectRootMap,
        externalNodes,
        projectRootMap: rootMap,
        sourceMaps: configurationSourceMaps,
        matchingProjectFiles: allProjectFilesFlat,
      });
    }
  });
}

type CreateNodesResultEntry = readonly [
  plugin: string,
  file: string,
  result: CreateNodesResult,
  pluginIndex?: number,
];

type MergeError =
  | AggregateCreateNodesError
  | MergeNodesError
  | ProjectsWithNoNameError
  | MultipleProjectsWithSameNameError
  | WorkspaceValidityError;

/**
 * Merges create nodes results into a single rootMap.
 *
 * Default plugin results are merged twice: first into an intermediate
 * rootMap with unresolved spread sentinels preserved, so target
 * defaults selection sees the real merged shape of defaults; then
 * applied as a single layer onto the main rootMap where the preserved
 * spreads resolve against the specified + target-defaults base.
 */
export function mergeCreateNodesResults(
  specifiedResults: CreateNodesResultEntry[][],
  defaultResults: CreateNodesResultEntry[][],
  nxJsonConfiguration: NxJsonConfiguration,
  workspaceRoot: string,
  errors: MergeError[]
) {
  performance.mark('createNodes:merge - start');

  const nodesManager = new ProjectNodesManager();
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  const configurationSourceMaps: ConfigurationSourceMaps = {};
  const intermediateDefaultRootMap: Record<string, ProjectConfiguration> = {};
  // Kept separate so the intermediate merge doesn't clobber
  // specified/TD attribution on fields the defaults don't touch.
  const defaultConfigurationSourceMaps: ConfigurationSourceMaps = {};

  type MergeFn = (
    project: ProjectConfiguration,
    sourceInfo: SourceInformation
  ) => void;

  const mergeToManager: MergeFn = (project, sourceInfo) =>
    nodesManager.mergeProjectNode(
      project,
      configurationSourceMaps,
      sourceInfo
    );

  const mergeToIntermediate: MergeFn = (project, sourceInfo) => {
    mergeProjectConfigurationIntoRootMap(
      intermediateDefaultRootMap,
      project,
      defaultConfigurationSourceMaps,
      sourceInfo,
      false,
      true
    );
  };

  const processBatch = (
    pluginResults: CreateNodesResultEntry[],
    mergeFn: MergeFn
  ) => {
    for (const result of pluginResults) {
      const [pluginName, file, nodes, pluginIndex] = result;
      const { projects: projectNodes, externalNodes: pluginExternalNodes } =
        nodes;
      const sourceInfo: SourceInformation = [file, pluginName];

      for (const root in projectNodes) {
        if (!projectNodes[root]) continue;
        const project = { root, ...projectNodes[root] };

        try {
          mergeFn(project, sourceInfo);
        } catch (error) {
          errors.push(
            new MergeNodesError({ file, pluginName, error, pluginIndex })
          );
        }
      }

      Object.assign(externalNodes, pluginExternalNodes);
    }

    // Substitutor registration runs after all projects in the batch are
    // merged so forward references inside the same batch resolve.
    for (const result of pluginResults) {
      const [pluginName, file, nodes, pluginIndex] = result;
      const { projects: projectNodes } = nodes;

      try {
        nodesManager.registerSubstitutors(projectNodes);
      } catch (error) {
        errors.push(
          new MergeNodesError({ file, pluginName, error, pluginIndex })
        );
      }
    }
  };

  for (const pluginResults of specifiedResults) {
    processBatch(pluginResults, mergeToManager);
  }

  for (const pluginResults of defaultResults) {
    processBatch(pluginResults, mergeToIntermediate);
  }

  const targetDefaultsResults = createTargetDefaultsResults(
    nodesManager.getRootMap(),
    intermediateDefaultRootMap,
    nxJsonConfiguration
  );

  if (targetDefaultsResults.length > 0) {
    processBatch(targetDefaultsResults, mergeToManager);
  }

  // Apply the intermediate default rootMap as a single layer. Preserved
  // spread sentinels resolve here against the real specified + TD base.
  // Source maps are intentionally not written — TD attribution for
  // fields that yield to the base (e.g. keys before `...`) stays intact.
  for (const root in intermediateDefaultRootMap) {
    const project = intermediateDefaultRootMap[root];
    try {
      nodesManager.mergeProjectNode(project, undefined, undefined);
    } catch (error) {
      errors.push(
        new MergeNodesError({
          file: 'nx.json',
          pluginName: 'nx/default-plugins',
          error,
          pluginIndex: undefined,
        })
      );
    }
  }

  // Overlay default-plugin attribution onto the main source maps.
  //
  // Known edge case: if a default plugin placed `...` after other keys,
  // those keys yield to the base during the single-layer apply above
  // but still appear here from the intermediate merge — in that rare
  // case the overlay misattributes the field to the default plugin.
  for (const root in defaultConfigurationSourceMaps) {
    configurationSourceMaps[root] ??= {};
    Object.assign(
      configurationSourceMaps[root],
      defaultConfigurationSourceMaps[root]
    );
  }

  const projectRootMap = nodesManager.getRootMap();

  try {
    nodesManager.applySubstitutions();
    validateAndNormalizeProjectRootMap(
      workspaceRoot,
      projectRootMap,
      nxJsonConfiguration,
      configurationSourceMaps
    );
  } catch (error) {
    let _errors = error instanceof AggregateError ? error.errors : [error];
    for (const e of _errors) {
      if (
        isProjectsWithNoNameError(e) ||
        isMultipleProjectsWithSameNameError(e) ||
        isWorkspaceValidityError(e)
      ) {
        errors.push(e);
      } else {
        throw e;
      }
    }
  }

  const rootMap = createRootMap(projectRootMap);

  performance.mark('createNodes:merge - end');
  performance.measure(
    'createNodes:merge',
    'createNodes:merge - start',
    'createNodes:merge - end'
  );
  return { projectRootMap, externalNodes, rootMap, configurationSourceMaps };
}

/**
 * Fast matcher for patterns without negations - uses short-circuit evaluation.
 */
function matchesSimplePatterns(file: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(file, pattern, { dot: true }));
}

/**
 * Full matcher for patterns with negations - processes all patterns sequentially.
 * Patterns starting with '!' are negation patterns that remove files from the match set.
 * Patterns are processed in order, with later patterns overriding earlier ones.
 */
function matchesNegationPatterns(file: string, patterns: string[]): boolean {
  // If first pattern is negation, start by matching everything
  let isMatch = patterns[0].startsWith('!');

  for (const pattern of patterns) {
    const isNegation = pattern.startsWith('!');
    const actualPattern = isNegation ? pattern.substring(1) : pattern;

    if (minimatch(file, actualPattern, { dot: true })) {
      // Last matching pattern wins
      isMatch = !isNegation;
    }
  }

  return isMatch;
}

/**
 * Creates a matcher function for the given patterns.
 * @param patterns Array of glob patterns (can include negation patterns starting with '!')
 * @param emptyValue Value to return when patterns array is empty
 * @returns A function that checks if a file matches the patterns
 */
function createMatcher(
  patterns: string[],
  emptyValue: boolean
): (file: string) => boolean {
  if (!patterns || patterns.length === 0) {
    return () => emptyValue;
  }

  const hasNegationPattern = patterns.some((p) => p.startsWith('!'));

  return hasNegationPattern
    ? (file: string) => matchesNegationPatterns(file, patterns)
    : (file: string) => matchesSimplePatterns(file, patterns);
}

export function findMatchingConfigFiles(
  projectFiles: string[],
  pattern: string,
  include: string[],
  exclude: string[]
): string[] {
  const matchingConfigFiles: string[] = [];

  // Create matchers once, outside the loop
  // Empty include means include everything, empty exclude means exclude nothing
  const includes = createMatcher(include, true);
  const excludes = createMatcher(exclude, false);

  for (const file of projectFiles) {
    if (minimatch(file, pattern, { dot: true })) {
      if (!includes(file)) {
        continue;
      }

      if (excludes(file)) {
        continue;
      }

      matchingConfigFiles.push(file);
    }
  }

  return matchingConfigFiles;
}
