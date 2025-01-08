import type { ProjectGraph } from '../../config/project-graph';
import type { PluginConfiguration } from '../../config/nx-json';
import {
  AggregateCreateNodesError,
  isAggregateCreateNodesError,
} from '../error-types';
import type { RawProjectGraphDependency } from '../project-graph-builder';
import type {
  CreateDependenciesContext,
  CreateMetadataContext,
  CreateNodesContextV2,
  CreateNodesResult,
  NxPluginV2,
  ProjectsMetadata,
} from './public-api';
import { createNodesFromFiles } from './utils';

export class LoadedNxPlugin {
  readonly name: string;
  readonly createNodes?: [
    filePattern: string,
    // The create nodes function takes all matched files instead of just one, and includes
    // the result's context.
    fn: (
      matchedFiles: string[],
      context: CreateNodesContextV2
    ) => Promise<
      Array<readonly [plugin: string, file: string, result: CreateNodesResult]>
    >
  ];
  readonly createDependencies?: (
    context: CreateDependenciesContext
  ) => Promise<RawProjectGraphDependency[]>;
  readonly createMetadata?: (
    graph: ProjectGraph,
    context: CreateMetadataContext
  ) => Promise<ProjectsMetadata>;

  readonly options?: unknown;
  readonly include?: string[];
  readonly exclude?: string[];

  constructor(plugin: NxPluginV2, pluginDefinition: PluginConfiguration) {
    this.name = plugin.name;
    if (typeof pluginDefinition !== 'string') {
      this.options = pluginDefinition.options;
      this.include = pluginDefinition.include;
      this.exclude = pluginDefinition.exclude;
    }

    if (plugin.createNodes && !plugin.createNodesV2) {
      this.createNodes = [
        plugin.createNodes[0],
        (configFiles, context) =>
          createNodesFromFiles(
            plugin.createNodes[1],
            configFiles,
            this.options,
            context
          ).then((results) => results.map((r) => [this.name, r[0], r[1]])),
      ];
    }

    if (plugin.createNodesV2) {
      this.createNodes = [
        plugin.createNodesV2[0],
        async (configFiles, context) => {
          const result = await plugin.createNodesV2[1](
            configFiles,
            this.options,
            context
          );
          return result.map((r) => [this.name, r[0], r[1]]);
        },
      ];
    }

    if (this.createNodes) {
      const inner = this.createNodes[1];
      this.createNodes[1] = async (...args) => {
        performance.mark(`${plugin.name}:createNodes - start`);
        try {
          return await inner(...args);
        } catch (e) {
          if (isAggregateCreateNodesError(e)) {
            throw e;
          }
          // The underlying plugin errored out. We can't know any partial results.
          throw new AggregateCreateNodesError([[null, e]], []);
        } finally {
          performance.mark(`${plugin.name}:createNodes - end`);
          performance.measure(
            `${plugin.name}:createNodes`,
            `${plugin.name}:createNodes - start`,
            `${plugin.name}:createNodes - end`
          );
        }
      };
    }

    if (plugin.createDependencies) {
      this.createDependencies = async (context) =>
        plugin.createDependencies(this.options, context);
    }

    if (plugin.createMetadata) {
      this.createMetadata = async (graph, context) =>
        plugin.createMetadata(graph, this.options, context);
    }
  }
}

export type CreateNodesResultWithContext = CreateNodesResult & {
  file: string;
  pluginName: string;
};
