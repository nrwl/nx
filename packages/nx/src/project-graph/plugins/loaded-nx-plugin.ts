import type { ProjectGraph } from '../../config/project-graph';
import { type PluginConfiguration } from '../../config/nx-json';
import { customDimensions, PERF_SPAN_SAMPLE_RATE } from '../../analytics';
import {
  AggregateCreateNodesError,
  isAggregateCreateNodesError,
} from '../error-types';
import type { RawProjectGraphDependency } from '../project-graph-builder';
import type {
  CreateDependenciesContext,
  CreateMetadataContext,
  CreateNodesContext,
  CreateNodesResult,
  NxPlugin,
  PreTasksExecutionContext,
  ProjectsMetadata,
} from './public-api';
import { isIsolationEnabled } from './isolation/enabled';
import { isDaemonEnabled } from '../../daemon/client/client';
import {
  rehydrateTerminalOutputs,
  type MaybeStubbedPostTasksExecutionContext,
} from './task-results-stub';
import type { NxPluginCapabilities } from './nx-plugin-capabilities';

/**
 * NOTE: Avoid using `import type` with this class. It causes issues with
 * jest's module resolution when running tests in projects that import
 * the devkit-internals
 */
export class LoadedNxPlugin {
  readonly name: string;
  readonly createNodes?: [
    filePattern: string,
    // The create nodes function takes all matched files instead of just one, and includes
    // the result's context.
    fn: (
      matchedFiles: string[],
      context: CreateNodesContext
    ) => Promise<
      Array<readonly [plugin: string, file: string, result: CreateNodesResult]>
    >,
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
    context: MaybeStubbedPostTasksExecutionContext
  ) => Promise<void>;

  readonly options?: unknown;
  readonly include?: string[];
  readonly exclude?: string[];

  /**
   * Notifies the plugin that a phase was aborted mid-flight.
   * Overridden by IsolatedPlugin to reset lifecycle phase tracking so
   * the worker can still shut down properly.
   *
   * @param phase The phase that was aborted (e.g. 'graph').
   * @param lastCompletedHook The last hook that was called before the
   *   abort (e.g. 'createNodes').
   */
  notifyPhaseAborted?(phase: string, lastCompletedHook: string): void;

  /**
   * Forwards updated environment variables to the plugin worker process.
   * Only meaningful for isolated plugins; in-process plugins share the
   * daemon's process.env automatically.
   */
  setWorkerEnv?(env: Record<string, string>): Promise<void>;

  constructor(
    plugin: NxPlugin,
    pluginDefinition: PluginConfiguration,
    public readonly index?: number
  ) {
    this.name = plugin.name;
    if (typeof pluginDefinition !== 'string') {
      this.options = pluginDefinition.options;
      this.include = pluginDefinition.include;
      this.exclude = pluginDefinition.exclude;
    }

    // Fall back to `createNodesV2` for plugins authored against the old name.
    const createNodesImpl =
      plugin.createNodes ??
      (plugin as { createNodesV2?: NxPlugin['createNodes'] }).createNodesV2;
    if (createNodesImpl) {
      this.createNodes = [
        createNodesImpl[0],
        async (configFiles, context) => {
          const result = await createNodesImpl[1](
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
        let projectCount = 0;
        try {
          const result = (await inner(...args)).map(
            ([pluginName, file, r]) =>
              [pluginName, file, withoutUndefinedValues(r)] as const
          );
          for (const [, , r] of result) {
            projectCount += Object.keys(r.projects ?? {}).length;
          }
          return result;
        } catch (e) {
          if (isAggregateCreateNodesError(e)) {
            const partialResults = e.partialResults.map(
              ([file, r]) => [file, withoutUndefinedValues(r)] as const
            );
            if (
              partialResults.every(([, r], i) => r === e.partialResults[i][1])
            ) {
              throw e;
            }
            // Fresh tuples, as the constructor coerces each error in place.
            throw new AggregateCreateNodesError(
              e.errors.map(([file, error]): [string | null, Error] => [
                file,
                error,
              ]),
              partialResults
            );
          }
          // The underlying plugin errored out. We can't know any partial results.
          throw new AggregateCreateNodesError([[null, e]], []);
        } finally {
          performance.mark(`${plugin.name}:createNodes - end`);
          performance.measure(`${plugin.name}:createNodes`, {
            start: `${plugin.name}:createNodes - start`,
            end: `${plugin.name}:createNodes - end`,
            detail: {
              track: true,
              ...(customDimensions && {
                [customDimensions.projectCount]: projectCount,
                [customDimensions.sampleRate]: PERF_SPAN_SAMPLE_RATE,
              }),
            },
          });
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
      // The single rehydration point: every transport hands its context
      // straight here, so a context bound for an isolated plugin stays stubbed
      // across that second hop rather than being read and re-stubbed.
      this.postTasksExecution = async (
        context: MaybeStubbedPostTasksExecutionContext
      ) =>
        plugin.postTasksExecution(
          this.options,
          await rehydrateTerminalOutputs(context)
        );
    }
  }

  capabilities(): NxPluginCapabilities {
    return {
      createNodesPattern: this.createNodes?.[0],
      hasCreateDependencies: !!this.createDependencies,
      hasCreateMetadata: !!this.createMetadata,
      hasPreTasksExecution: !!this.preTasksExecution,
      hasPostTasksExecution: !!this.postTasksExecution,
    };
  }
}

/**
 * Drops `undefined` object values and turns `undefined` array entries into
 * `null`, as the default JSON transport does for isolated plugins. Without this,
 * results that skip JSON (in-process plugins, the v8 serializer) let an
 * `undefined` override an earlier plugin's value.
 * Never writes to the plugin-owned `value`: changed containers and their
 * ancestors are copied.
 */
function withoutUndefinedValues<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    let copy: unknown[] | undefined;
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const normalized =
        item === undefined ? null : withoutUndefinedValues(item);
      if (!copy && normalized !== item) {
        copy = value.slice(0, i);
      }
      copy?.push(normalized);
    }
    return (copy ?? value) as T;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  let entries: Array<[string, unknown]> | undefined;
  for (let i = 0; i < keys.length; i++) {
    const item = record[keys[i]];
    const normalized =
      item === undefined ? undefined : withoutUndefinedValues(item);
    if (!entries && (item === undefined || normalized !== item)) {
      entries = keys.slice(0, i).map((key) => [key, record[key]]);
    }
    if (entries && normalized !== undefined) {
      entries.push([keys[i], normalized]);
    }
  }
  // `Object.fromEntries` defines own properties, so a `__proto__` key stays
  // a key instead of setting the copy's prototype.
  return (entries ? Object.fromEntries(entries) : value) as T;
}
