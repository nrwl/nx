import type { ProjectGraph } from '../../config/project-graph';
import { readNxJson, type PluginConfiguration } from '../../config/nx-json';
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
  PostTasksExecutionContext,
  PreTasksExecutionContext,
  ProjectsMetadata,
} from './public-api';
import { createNodesFromFiles } from './utils';
import { isIsolationEnabled } from './isolation/enabled';
import { isDaemonEnabled } from '../../daemon/client/client';

export class LoadedNxPlugin {
  index?: number;
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
  readonly preTasksExecution?: (
    context: PreTasksExecutionContext
  ) => Promise<NodeJS.ProcessEnv>;
  readonly postTasksExecution?: (
    context: PostTasksExecutionContext
  ) => Promise<void>;

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
      throw new Error(
        `Plugin ${plugin.name} only provides \`createNodes\` which was removed in Nx 21, it should provide a \`createNodesV2\` implementation.`
      );
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

    if (plugin.preTasksExecution) {
      this.preTasksExecution = async (context: PreTasksExecutionContext) => {
        const updates = {};
        let originalEnv = process.env;
        if (isIsolationEnabled() || isDaemonEnabled()) {
          process.env = new Proxy<NodeJS.ProcessEnv>(originalEnv, {
            set: (target, key: string, value) => {
              target[key] = value;
              updates[key] = value;
              return true;
            },
          });
        }
        await plugin.preTasksExecution(this.options, context);
        // This doesn't revert env changes, as the proxy still updates
        // originalEnv, rather it removes the proxy.
        process.env = originalEnv;

        return updates;
      };
    }

    if (plugin.postTasksExecution) {
      this.postTasksExecution = async (context: PostTasksExecutionContext) =>
        plugin.postTasksExecution(this.options, context);
    }
  }
}
