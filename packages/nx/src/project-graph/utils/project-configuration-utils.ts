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

import { Minimatch } from 'minimatch';
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
import { deepClone } from './project-configuration/target-merging';
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
    const [, createNodes] = createNodesTuple;

    const matchingConfigFiles: string[] = findMatchingConfigFiles(
      allProjectFiles[index],
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
  mergeSinglePluginResults(pluginResults, mergeFn, externalNodes, errors);
  registerNameRefsFromSinglePlugin(
    pluginResults,
    nodesManager,
    nameRefRootMap,
    errors
  );
}

function mergeSinglePluginResults(
  pluginResults: CreateNodesResultEntry[],
  mergeFn: MergeFn,
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
}

function registerNameRefsFromSinglePlugin(
  pluginResults: CreateNodesResultEntry[],
  nodesManager: ProjectNodesManager,
  nameRefRootMap: Record<string, ProjectConfiguration>,
  errors: MergeError[]
): void {
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
 * Every layer merges into the manager through the same source-map-aware
 * merge, in precedence order:
 *
 *   specified plugins → synthetic target defaults → default plugins
 *
 * so field-level provenance is decided by the merge itself for all three
 * layers — whichever layer a field's final value came from owns its
 * attribution, and `'...'` spreads in default-plugin configs resolve against
 * the accumulated specified + target-defaults base.
 *
 * Target-default synthesis needs the *merged* shape of the default layer
 * (to predict each target's eventual executor/command) before that layer
 * merges into the manager. To get it, default results are first staged into
 * a throwaway intermediate rootMap with unresolvable `'...'` spreads
 * deferred. The staging output feeds only `createTargetDefaultsResults`; the
 * default plugins then merge into the manager from their original results.
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

  const mergeToManager: MergeFn = (project, sourceInfo) =>
    nodesManager.mergeProjectNode(project, configurationSourceMaps, sourceInfo);

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

  // Without target defaults there is nothing to synthesize, and the staging
  // pass exists only to feed synthesis — skip straight to the default-plugin
  // merge.
  if (Object.keys(nxJsonConfiguration.targetDefaults ?? {}).length > 0) {
    // Throwaway staging area: the default layer's merged shape (unresolvable
    // `'...'` spreads deferred), read only by target-default synthesis. The
    // default plugins merge into the manager from their original results, not
    // from this map. No source maps are kept for it — synthesis attributes
    // targets without them (a default plugin can never be named by a
    // `filter.plugin`); the real default merge writes the manager's.
    const intermediateDefaultRootMap: Record<string, ProjectConfiguration> = {};

    // The rootMap merge adopts input arrays/objects by reference and grows
    // them in place (e.g. `mergeMetadata`), so staging works on deep clones —
    // handing it the plugin results themselves would corrupt them before the
    // real merge below reads them.
    const mergeToIntermediate: MergeFn = (project, sourceInfo) => {
      mergeProjectConfigurationIntoRootMap(
        intermediateDefaultRootMap,
        deepClone(project),
        undefined,
        sourceInfo,
        false,
        true
      );
    };

    // Stage the default layer for synthesis. Merge errors are discarded and
    // external nodes land in a scratch object — the same results merge into
    // the manager below, where both surface once with proper plugin context.
    // The discard is safe because every merge throw depends only on the
    // plugin's own config, never on the merge base (which differs between
    // the two passes).
    // Name references are NOT registered here: sentinels registered against
    // the throwaway rootMap would mutate the plugin results and be orphaned.
    const stagingErrors: MergeError[] = [];
    const stagingExternalNodes: Record<string, ProjectGraphExternalNode> = {};
    for (const pluginResults of defaultResults) {
      mergeSinglePluginResults(
        pluginResults,
        mergeToIntermediate,
        stagingExternalNodes,
        stagingErrors
      );
    }

    const targetDefaultsResults = createTargetDefaultsResults(
      nodesManager.getRootMap(),
      intermediateDefaultRootMap,
      nxJsonConfiguration,
      configurationSourceMaps
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
  }

  // Merge the default plugins into the manager on top of the specified + TD
  // base, from their original results. This is the same source-map-aware path
  // the other layers take, so every field a default plugin wins — including
  // fields it overrides on a specified/TD target — is attributed to it by the
  // merge itself, `'...'` spreads resolve against the real base (keys a spread
  // lets the base win keep their base attribution), and identity provenance
  // follows the node-ownership rules in `recordTargetIdentitySourceMapInfo` /
  // `getMergeValueResult`.
  for (const pluginResults of defaultResults) {
    mergeCreateNodesResultsFromSinglePlugin(
      pluginResults,
      mergeToManager,
      nodesManager,
      nodesManager.getRootMap(),
      externalNodes,
      errors
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
 * Creates a matcher function for the given patterns. Globs are compiled once
 * here so matching a file list only runs the pre-parsed regex per file, instead
 * of recompiling every pattern on each call.
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

  if (hasNegationPattern) {
    // Patterns are processed in order, with later matches overriding earlier
    // ones; a leading negation starts from "matches everything".
    const compiled = patterns.map((pattern) => {
      const isNegation = pattern.startsWith('!');
      return {
        isNegation,
        matcher: new Minimatch(isNegation ? pattern.substring(1) : pattern, {
          dot: true,
        }),
      };
    });
    const initialMatch = patterns[0].startsWith('!');
    return (file: string) => {
      let isMatch = initialMatch;
      for (const { isNegation, matcher } of compiled) {
        if (matcher.match(file)) {
          isMatch = !isNegation;
        }
      }
      return isMatch;
    };
  }

  const compiled = patterns.map((p) => new Minimatch(p, { dot: true }));
  return (file: string) => compiled.some((m) => m.match(file));
}

export function findMatchingConfigFiles(
  projectFiles: string[],
  include: string[],
  exclude: string[]
): string[] {
  // projectFiles already comes from multiGlobWithWorkspaceContext for the
  // plugin's createNodes pattern, so only include/exclude filters remain here.
  // Empty include means include everything, empty exclude means exclude nothing
  const includes = createMatcher(include, true);
  const excludes = createMatcher(exclude, false);

  return projectFiles.filter((file) => includes(file) && !excludes(file));
}
