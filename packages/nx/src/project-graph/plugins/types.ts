import {
  ProjectGraph,
  ProjectGraphProcessorContext,
} from '../../config/project-graph';
import { PluginConfiguration } from '../../config/nx-json';
import {
  CreateDependenciesContext,
  CreateNodesContext,
  NxPluginV2,
  RemotePlugin,
} from './nx-plugin';

export interface PluginWorkerLoadMessage {
  type: 'load';
  payload: {
    plugin: PluginConfiguration;
    root: string;
  };
}

export interface PluginWorkerLoadResult {
  type: 'load-result';
  payload:
    | {
        name: string;
        createNodesPattern: string;
        hasCreateDependencies: boolean;
        hasProcessProjectGraph: boolean;
        success: true;
      }
    | {
        success: false;
        error: string;
      };
}

export interface PluginWorkerShutdownMessage {
  type: 'shutdown';
  payload: undefined;
}

export interface PluginWorkerCreateNodesMessage {
  type: 'createNodes';
  payload: {
    configFiles: string[];
    context: CreateNodesContext;
  };
}

export interface PluginWorkerCreateNodesResult {
  type: 'createNodesResult';
  payload:
    | {
        success: true;
        result: Awaited<ReturnType<RemotePlugin['createNodes'][1]>>;
      }
    | {
        success: false;
        error: string;
      };
}

export interface PluginCreateDependenciesMessage {
  type: 'createDependencies';
  payload: {
    context: CreateDependenciesContext;
  };
}

export interface PluginCreateDependenciesResult {
  type: 'createDependenciesResult';
  payload:
    | {
        dependencies: ReturnType<RemotePlugin['createDependencies']>;
        success: true;
      }
    | {
        success: false;
        error: string;
      };
}

export interface PluginWorkerProcessProjectGraphMessage {
  type: 'processProjectGraph';
  payload: {
    graph: ProjectGraph;
    ctx: ProjectGraphProcessorContext;
  };
}

export interface PluginWorkerProcessProjectGraphResult {
  type: 'processProjectGraphResult';
  payload:
    | {
        graph: ProjectGraph;
        success: true;
      }
    | {
        success: false;
        error: string;
      };
}

export type PluginWorkerMessage =
  | PluginWorkerLoadMessage
  | PluginWorkerShutdownMessage
  | PluginWorkerCreateNodesMessage
  | PluginCreateDependenciesMessage
  | PluginWorkerProcessProjectGraphMessage;

export type PluginWorkerResult =
  | PluginWorkerLoadResult
  | PluginWorkerCreateNodesResult
  | PluginCreateDependenciesResult
  | PluginWorkerProcessProjectGraphResult;

// Takes a message and a map of handlers and calls the appropriate handler
// type safe and requires all handlers to be handled
export async function consumeMessage<
  T extends PluginWorkerMessage | PluginWorkerResult
>(
  raw: string | T,
  handlers: {
    [K in T['type']]: (
      payload: Extract<T, { type: K }>['payload']
    ) => T extends PluginWorkerResult
      ? void | Promise<void>
      : PluginWorkerResult | void | Promise<PluginWorkerResult> | Promise<void>;
  },
  allowUnhandled = false
) {
  const message: T = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const handler = handlers[message.type];
  if (handler) {
    const response = await handler(message.payload);
    if (response) {
      process.send!(createMessage(response));
    }
  } else if (!allowUnhandled) {
    throw new Error(`Unhandled message type: ${message.type}`);
  }
}

export function createMessage(
  message: PluginWorkerMessage | PluginWorkerResult
): string {
  return JSON.stringify(message);
}
