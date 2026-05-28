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
import { formatPluginProgressText } from '../../utils/plugin-progress-text';
import { ProgressTopics } from '../../utils/progress-topics';
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

import { createTargetDefaultsResults } from './project-configuration/target-defaults';

export { mergeTargetConfigurations } from './project-configuration/target-merging';
export { readTargetDefaultsForTarget } from './project-configuration/target-defaults';

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

  const getSpinnerText = () =>
    spinner
      ? formatPluginProgressText(
          'Creating project graph nodes',
          inProgressPlugins
        )
      : '';

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
  spinner = new DelayedSpinner(getSpinnerText(), {
    progressTopic: ProgressTopics.GraphConstruction,
  });

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
        spinner.setMessage(getSpinnerText());
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

export type CreateNodesResultEntry = readonly [
  plugin: string,
  file: string,
  result: CreateNodesResult,
  pluginIndex?: number,
];

export type MergeError =
  | AggregateCreateNodesError
  | MergeNodesError
  | ProjectsWithNoNameError
  | MultipleProjectsWithSameNameError
  | WorkspaceValidityError;

type MergeFn = (
  project: ProjectConfiguration,
  sourceInfo: SourceInformation
) => void;

/**
 * Runs a single plugin batch through two passes:
 *
 * 1. Every project node in every plugin result is handed to `mergeFn`,
 *    which decides where it lands (the manager's rootMap, an
 *    intermediate rootMap, etc.). Any failure is collected into
 *    `errors`; processing keeps going. External nodes are accumulated
 *    onto the shared `externalNodes` record.
 * 2. After every project in the batch has been merged, name-reference
 *    sentinels for the batch are registered against `nameRefRootMap` —
 *    the rootMap the batch was merged into — so sentinels point at the
 *    target objects that actually received the merges.
 *
 * The two passes can't be collapsed: a sentinel registered too early
 * would point at the pre-merge object, and a later project in the same
 * batch may still rename a project the sentinel refers to. Splitting
 * the registration into a second pass also lets forward references
 * inside the same batch resolve eagerly.
 */
function mergeCreateNodesResultsFromSinglePlugin(
  pluginResults: CreateNodesResultEntry[],
  mergeFn: MergeFn,
  nodesManager: ProjectNodesManager,
  nameRefRootMap: Record<string, ProjectConfiguration>,
  externalNodes: Record<string, ProjectGraphExternalNode>,
  errors: MergeError[]
): void {
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

  for (const result of pluginResults) {
    const [pluginName, file, nodes, pluginIndex] = result;
    const { projects: projectNodes } = nodes;

    try {
      nodesManager.registerNameRefs(projectNodes, nameRefRootMap);
    } catch (error) {
      errors.push(
        new MergeNodesError({ file, pluginName, error, pluginIndex })
      );
    }
  }
}

/**
 * Merges create nodes results into a single rootMap.
 *
 * Specified plugin results are merged once into the manager. Default
 * plugin results are first staged into an intermediate rootMap (with
 * `'...'` spreads deferred) so that synthesis can read each layer's
 * contribution without re-running the merge. The synthetic result from
 * `createTargetDefaultsResults` is then merged into the manager, and
 * the staged intermediate is replayed on top — that replay is where
 * deferred spreads expand against the final (specified + synth) base.
 *
 * Synthesis itself doesn't materialize a second rootMap. Per
 * (root, target) it does an on-the-fly merge of the two layered
 * contributions to learn the eventual executor/command, then matches
 * defaults against that merged shape. This keeps specified-plugin
 * merge work to a single pass.
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

  const mergeToManager: MergeFn = (project, sourceInfo) =>
    nodesManager.mergeProjectNode(project, configurationSourceMaps, sourceInfo);

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

  for (const pluginResults of specifiedResults) {
    mergeCreateNodesResultsFromSinglePlugin(
      pluginResults,
      mergeToManager,
      nodesManager,
      nodesManager.getRootMap(),
      externalNodes,
      errors
    );
  }

  for (const pluginResults of defaultResults) {
    mergeCreateNodesResultsFromSinglePlugin(
      pluginResults,
      mergeToIntermediate,
      nodesManager,
      intermediateDefaultRootMap,
      externalNodes,
      errors
    );
  }

  const targetDefaultsResults = createTargetDefaultsResults(
    nodesManager.getRootMap(),
    intermediateDefaultRootMap,
    nxJsonConfiguration,
    configurationSourceMaps,
    defaultConfigurationSourceMaps
  );

  if (targetDefaultsResults.length > 0) {
    mergeCreateNodesResultsFromSinglePlugin(
      targetDefaultsResults,
      mergeToManager,
      nodesManager,
      nodesManager.getRootMap(),
      externalNodes,
      errors
    );
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

  // The intermediate apply may have rebuilt dependsOn / inputs arrays
  // via spread merges, leaving sentinels inserted against the
  // intermediate rootMap pointing at now-orphaned arrays. Re-walking
  // the final merged targets rebinds each encountered sentinel's
  // `parent` to the current array (see
  // ProjectNameInNodePropsManager#processInputs / processDependsOn).
  nodesManager.registerNameRefs(intermediateDefaultRootMap);

  // Overlay default-plugin attribution onto the main source maps using
  // "only fill missing" semantics. Any key already present in
  // configurationSourceMaps was written by a specified plugin or by
  // target defaults, and that attribution is strictly more correct:
  //  - For fields the default plugin never shadowed, the existing entry
  //    already matches what the default plugin would overlay.
  //  - For fields where a default plugin placed `...` after other keys,
  //    those keys yielded to the base during the single-layer apply
  //    above. The stale default-plugin entry in
  //    `defaultConfigurationSourceMaps` must NOT clobber the base
  //    attribution that the specified plugin / TD already recorded.
  for (const root in defaultConfigurationSourceMaps) {
    const existing = (configurationSourceMaps[root] ??= {});
    const incoming = defaultConfigurationSourceMaps[root];
    for (const key in incoming) {
      if (existing[key] === undefined) {
        existing[key] = incoming[key];
      }
    }
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
