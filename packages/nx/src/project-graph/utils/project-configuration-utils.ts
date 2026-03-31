import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
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
import { getMergeValueResult } from './project-configuration-utils/utils';

export {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from './project-configuration/target-merging';

/**
 * Tracks the state of a project configuration as it's being built up from multiple sources.
 * Spread tokens are partially evaluated in the snapshot (good enough for target defaults lookups).
 * At the end, we re-resolve properties with spread tokens using the sources.
 */
type ProjectConfigurationState = {
  /** Current merged view (spread tokens partially evaluated against available base) */
  snapshot: ProjectConfiguration;
  /** Ordered list of all configurations that contributed to this project */
  sources: Array<[SourceInformation, Partial<ProjectConfiguration>]>;
  /** Source map for this specific project (updated during merging, refined during final resolution) */
  sourceMap: Record<string, SourceInformation>;
  /** Quick check: does this project have any spread tokens that need final resolution? */
  hasSpreadTokens: boolean;
};

const NX_SPREAD_TOKEN = '...';

/**
 * Recursively checks if a value contains the spread token ('...')
 */
function containsSpreadToken(value: any): boolean {
  if (value === NX_SPREAD_TOKEN) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSpreadToken(item));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((v) => containsSpreadToken(v));
  }
  return false;
}

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
 * Uses a two-phase approach to ensure spread tokens in default plugin
 * configurations (project.json, package.json) can reference target defaults:
 *
 * Phase 1: Process specified plugins (from nx.json) and default plugins
 *          separately, merging results within each set.
 * Phase 2: Apply target defaults between the two sets, then merge default
 *          plugin results on top so that '...' expands with target defaults.
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
      mergeCreateNodesResultsTwoPhase(
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
 * Merges a project configuration into a ProjectConfigurationState, tracking sources
 * and updating the snapshot for quick lookups (like target defaults).
 */
function mergeProjectConfigurationIntoState(
  states: Map<string, ProjectConfigurationState>,
  project: ProjectConfiguration,
  sourceInformation: SourceInformation,
  snapshotRootMap: Record<string, ProjectConfiguration>
): void {
  const root = project.root === '' ? '.' : project.root;

  if (!states.has(root)) {
    states.set(root, {
      snapshot: { root },
      sources: [],
      sourceMap: {},
      hasSpreadTokens: false,
    });
    // Initialize empty snapshot in the snapshotRootMap too
    snapshotRootMap[root] = { root };
  }

  const state = states.get(root)!;

  // Append this configuration to sources
  state.sources.push([sourceInformation, project]);

  // Check if this config has spread tokens
  if (!state.hasSpreadTokens && containsSpreadToken(project)) {
    state.hasSpreadTokens = true;
  }

  // Create a temporary source map object that mergeProjectConfigurationIntoRootMap will populate
  const tempSourceMap: Record<string, SourceInformation> = {};

  // Update snapshot using existing merge logic
  // The snapshot gives us a quick view for target defaults, even if spreads aren't perfect yet
  mergeProjectConfigurationIntoRootMap(
    snapshotRootMap,
    project,
    { [root]: tempSourceMap },
    sourceInformation,
    true // skipTargetNormalization
  );

  // Merge the temp source map into the state's source map
  Object.assign(state.sourceMap, tempSourceMap);

  // Sync state snapshot with the merged result
  state.snapshot = snapshotRootMap[root];
}

/**
 * Processes plugin results into ProjectConfigurationStates, tracking sources
 * and building snapshots for quick lookups.
 */
function mergePluginResultsIntoStates(
  results: CreateNodesResultEntry[][],
  states: Map<string, ProjectConfigurationState>,
  snapshotRootMap: Record<string, ProjectConfiguration>,
  externalNodes: Record<string, ProjectGraphExternalNode>,
  errors: MergeError[]
) {
  for (const result of results.flat()) {
    const [pluginName, file, nodes, pluginIndex] = result;

    const { projects: projectNodes, externalNodes: pluginExternalNodes } =
      nodes;

    const sourceInfo: SourceInformation = [file, pluginName];

    for (const node in projectNodes) {
      // Handles `{projects: {'libs/foo': undefined}}`.
      if (!projectNodes[node]) {
        continue;
      }
      const project = {
        root: node,
        ...projectNodes[node],
      };
      try {
        mergeProjectConfigurationIntoState(
          states,
          project,
          sourceInfo,
          snapshotRootMap
        );
      } catch (error) {
        errors.push(
          new MergeNodesError({
            file,
            pluginName,
            error,
            pluginIndex,
          })
        );
      }
    }
    Object.assign(externalNodes, pluginExternalNodes);
  }
}

/**
 * Resolves spread tokens in project configurations by walking backwards through sources.
 * Only processes properties that actually contain '...' in the final snapshot.
 */
function resolveSpreadTokensInStates(
  states: Map<string, ProjectConfigurationState>,
  configurationSourceMaps: ConfigurationSourceMaps
): Record<string, ProjectConfiguration> {
  const projectRootMap: Record<string, ProjectConfiguration> = {};

  for (const [root, state] of states) {
    if (!state.hasSpreadTokens) {
      // Fast path: no spreads to resolve, use snapshot as-is
      projectRootMap[root] = state.snapshot;
      configurationSourceMaps[root] = state.sourceMap;
      continue;
    }

    // Slow path: resolve spread tokens by walking backwards through sources
    // Start with the snapshot (which has spreads partially evaluated)
    const resolved = { ...state.snapshot };
    const sourceMap = { ...state.sourceMap };

    // For each target that might have spread tokens
    if (resolved.targets) {
      for (const targetName in resolved.targets) {
        const target = resolved.targets[targetName];

        // Resolve spread tokens in target properties
        resolved.targets[targetName] = resolveSpreadTokensInTarget(
          targetName,
          target,
          state.sources,
          sourceMap
        );
      }
    }

    projectRootMap[root] = resolved;
    configurationSourceMaps[root] = sourceMap;
  }

  return projectRootMap;
}

/**
 * Resolves spread tokens in a target configuration by walking backwards through sources.
 */
function resolveSpreadTokensInTarget(
  targetName: string,
  target: TargetConfiguration,
  sources: Array<[SourceInformation, Partial<ProjectConfiguration>]>,
  sourceMap: Record<string, SourceInformation>
): TargetConfiguration {
  const resolved = { ...target };

  // Check each property for spread tokens
  for (const key in target) {
    if (containsSpreadToken(target[key])) {
      // Walk backwards through sources to resolve this property
      const resolvedValue = resolvePropertyWithSpread(
        `targets.${targetName}.${key}`,
        target[key],
        sources,
        sourceMap
      );
      resolved[key] = resolvedValue;
    }
  }

  return resolved;
}

/**
 * Resolves a single property that contains spread tokens by walking backwards through sources.
 * Uses a stack-based approach to handle nested spreads.
 */
function resolvePropertyWithSpread(
  propertyPath: string,
  currentValue: any,
  sources: Array<[SourceInformation, Partial<ProjectConfiguration>]>,
  sourceMap: Record<string, SourceInformation>
): any {
  // Start from the most recent value and walk backwards
  let value = currentValue;

  // Walk backwards through sources
  for (let i = sources.length - 1; i >= 0; i--) {
    const [sourceInfo, partialConfig] = sources[i];

    // Extract the value at this property path from this source
    const sourceValue = getValueAtPath(partialConfig, propertyPath);

    if (sourceValue !== undefined) {
      // Merge this source value with what we have
      value = getMergeValueResult(
        getPreviousValue(propertyPath, sources, i - 1),
        sourceValue,
        { sourceMap, key: propertyPath, sourceInformation: sourceInfo }
      );

      // If the result no longer has spread tokens, we're done
      if (!containsSpreadToken(value)) {
        break;
      }
    }
  }

  return value;
}

/**
 * Gets the value at a property path from a partial configuration.
 * e.g., "targets.build.inputs" => partialConfig.targets?.build?.inputs
 */
function getValueAtPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Gets the accumulated value for a property by merging all sources up to maxIndex.
 */
function getPreviousValue(
  propertyPath: string,
  sources: Array<[SourceInformation, Partial<ProjectConfiguration>]>,
  maxIndex: number
): any {
  let value = undefined;

  for (let i = 0; i <= maxIndex; i++) {
    const [, partialConfig] = sources[i];
    const sourceValue = getValueAtPath(partialConfig, propertyPath);

    if (sourceValue !== undefined) {
      if (value === undefined) {
        value = sourceValue;
      } else {
        // Merge without spread evaluation (just simple merge)
        value = sourceValue;
      }
    }
  }

  return value;
}

/**
 * Two-phase merge for project configurations.
 *
 * Phase 1: Merge specified plugin results into a root map.
 * Phase 1.5: Apply target defaults to the root map. For targets that will
 *            be introduced by default plugins, add target defaults as a base.
 * Phase 2: Merge default plugin results on top. Spread tokens in default
 *          plugin targets now expand against (specified + target defaults).
 * Phase 3: Validate and normalize (without re-applying target defaults).
 */
function mergeCreateNodesResultsTwoPhase(
  specifiedResults: CreateNodesResultEntry[][],
  defaultResults: CreateNodesResultEntry[][],
  nxJsonConfiguration: NxJsonConfiguration,
  workspaceRoot: string,
  errors: MergeError[]
) {
  performance.mark('createNodes:merge - start');

  const states = new Map<string, ProjectConfigurationState>();
  const snapshotRootMap: Record<string, ProjectConfiguration> = {};
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  const configurationSourceMaps: ConfigurationSourceMaps = {};

  // Phase 1: Process specified plugin results into states
  mergePluginResultsIntoStates(
    specifiedResults,
    states,
    snapshotRootMap,
    externalNodes,
    errors
  );

  // Phase 2: Build a separate snapshot for default plugins (for target defaults comparison)
  const defaultPluginStates = new Map<string, ProjectConfigurationState>();
  const defaultPluginSnapshotMap: Record<string, ProjectConfiguration> = {};
  mergePluginResultsIntoStates(
    defaultResults,
    defaultPluginStates,
    defaultPluginSnapshotMap,
    externalNodes,
    errors
  );

  // Phase 3: Create target defaults by comparing the two snapshots
  const targetDefaultsResults = createTargetDefaultsResults(
    snapshotRootMap,
    defaultPluginSnapshotMap,
    nxJsonConfiguration
  );

  // Phase 4: Merge target defaults (middle layer) into main states
  if (targetDefaultsResults.length > 0) {
    mergePluginResultsIntoStates(
      [targetDefaultsResults],
      states,
      snapshotRootMap,
      externalNodes,
      errors
    );
  }

  // Phase 5: Merge default plugin results into main states
  mergePluginResultsIntoStates(
    defaultResults,
    states,
    snapshotRootMap,
    externalNodes,
    errors
  );

  // Phase 6: Resolve spread tokens for projects that have them
  const projectRootMap = resolveSpreadTokensInStates(
    states,
    configurationSourceMaps
  );

  // Phase 7: Validate and normalize (skip target defaults since they were applied in phase 4)
  try {
    validateAndNormalizeProjectRootMap(
      workspaceRoot,
      projectRootMap,
      nxJsonConfiguration,
      configurationSourceMaps,
      true // skipTargetDefaults - already applied in two-phase merge
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
 * Merges create nodes results using ProjectNodesManager.
 * Used by code paths that don't need spread token support.
 */
export function mergeCreateNodesResults(
  results: (readonly [
    plugin: string,
    file: string,
    result: CreateNodesResult,
    pluginIndex?: number,
  ])[][],
  nxJsonConfiguration: NxJsonConfiguration,
  workspaceRoot: string,
  errors: (
    | AggregateCreateNodesError
    | MergeNodesError
    | ProjectsWithNoNameError
    | MultipleProjectsWithSameNameError
    | WorkspaceValidityError
  )[]
) {
  performance.mark('createNodes:merge - start');
  const nodesManager = new ProjectNodesManager();
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  const configurationSourceMaps: Record<
    string,
    Record<string, SourceInformation>
  > = {};

  // Process each plugin's results in two phases:
  //   Phase 1: Merge all projects from this plugin into rootMap/nameMap
  //   Phase 2: Register substitutors for this plugin's results
  //
  // Per-plugin batching ensures that:
  //  - All same-plugin projects are in the nameMap before substitutor
  //    registration (fixes cross-file references like kafka-stream)
  //  - Later-plugin renames haven't occurred yet, so dependsOn strings
  //    that reference old names can still be resolved via the nameMap
  for (const pluginResults of results) {
    // Phase 1: Merge all projects from this plugin batch
    for (const result of pluginResults) {
      const [pluginName, file, nodes, pluginIndex] = result;

      const { projects: projectNodes, externalNodes: pluginExternalNodes } =
        nodes;

      const sourceInfo: SourceInformation = [file, pluginName];

      for (const root in projectNodes) {
        // Handles `{projects: {'libs/foo': undefined}}`.
        if (!projectNodes[root]) {
          continue;
        }
        const project = {
          root: root,
          ...projectNodes[root],
        };

        try {
          nodesManager.mergeProjectNode(
            project,
            configurationSourceMaps,
            sourceInfo
          );
        } catch (error) {
          errors.push(
            new MergeNodesError({
              file,
              pluginName,
              error,
              pluginIndex,
            })
          );
        }
      }

      Object.assign(externalNodes, pluginExternalNodes);
    }

    // Phase 2: Register substitutors for this plugin batch. The nameMap
    // now contains all projects from this plugin (and all prior plugins)
    // so splitTargetFromConfigurations can resolve colon-delimited strings.
    for (const result of pluginResults) {
      const [pluginName, file, nodes, pluginIndex] = result;
      const { projects: projectNodes } = nodes;

      try {
        nodesManager.registerSubstitutors(projectNodes);
      } catch (error) {
        errors.push(
          new MergeNodesError({
            file,
            pluginName,
            error,
            pluginIndex,
          })
        );
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
