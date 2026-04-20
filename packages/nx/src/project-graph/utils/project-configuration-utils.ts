import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  createRootMap,
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

export {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from './project-configuration/target-merging';

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
 * @param root The workspace root
 * @param nxJson The NxJson configuration
 * @param workspaceFiles A list of non-ignored workspace files
 * @param plugins The plugins that should be used to infer project configuration
 */
export async function createProjectConfigurationsWithPlugins(
  root: string = workspaceRoot,
  nxJson: NxJsonConfiguration,
  projectFiles: string[][], // making this parameter allows devkit to pick up newly created projects
  plugins: LoadedNxPlugin[]
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

  const createNodesPlugins = plugins.filter(
    (plugin) => plugin.createNodes?.[0]
  );
  spinner = new DelayedSpinner(
    `Creating project graph nodes with ${createNodesPlugins.length} plugins`
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
  ] of createNodesPlugins.entries()) {
    const [pattern, createNodes] = createNodesTuple;

    const matchingConfigFiles: string[] = findMatchingConfigFiles(
      projectFiles[index],
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

    const { projectRootMap, externalNodes, rootMap, configurationSourceMaps } =
      mergeCreateNodesResults(results, nxJson, root, errors);

    performance.mark('build-project-configs:end');
    performance.measure(
      'build-project-configs',
      'build-project-configs:start',
      'build-project-configs:end'
    );

    if (errors.length === 0) {
      return {
        projects: projectRootMap,
        externalNodes,
        projectRootMap: rootMap,
        sourceMaps: configurationSourceMaps,
        matchingProjectFiles: projectFiles.flat(),
      };
    } else {
      throw new ProjectConfigurationsError(errors, {
        projects: projectRootMap,
        externalNodes,
        projectRootMap: rootMap,
        sourceMaps: configurationSourceMaps,
        matchingProjectFiles: projectFiles.flat(),
      });
    }
  });
}

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
