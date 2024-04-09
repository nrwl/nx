import {
  ProjectGraph,
  ProjectGraphProcessorContext,
} from '../../../config/project-graph';
import { PluginConfiguration } from '../../../config/nx-json';
import { CreateDependenciesContext, CreateNodesContext } from '../public-api';
import { LoadedNxPlugin } from '../internal-api';

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

export interface PluginWorkerCreateNodesMessage {
  type: 'createNodes';
  payload: {
    configFiles: string[];
    context: CreateNodesContext;
    tx: string;
  };
}

export interface PluginWorkerCreateNodesResult {
  type: 'createNodesResult';
  payload:
    | {
        success: true;
        result: Awaited<ReturnType<LoadedNxPlugin['createNodes'][1]>>;
        tx: string;
      }
    | {
        success: false;
        error: string;
        tx: string;
      };
}

export interface PluginCreateDependenciesMessage {
  type: 'createDependencies';
  payload: {
    context: CreateDependenciesContext;
    tx: string;
  };
}

export interface PluginCreateDependenciesResult {
  type: 'createDependenciesResult';
  payload:
    | {
        dependencies: ReturnType<LoadedNxPlugin['createDependencies']>;
        success: true;
        tx: string;
      }
    | {
        success: false;
        error: string;
        tx: string;
      };
}

export interface PluginWorkerProcessProjectGraphMessage {
  type: 'processProjectGraph';
  payload: {
    graph: ProjectGraph;
    ctx: ProjectGraphProcessorContext;
    tx: string;
  };
}

export interface PluginWorkerProcessProjectGraphResult {
  type: 'processProjectGraphResult';
  payload:
    | {
        graph: ProjectGraph;
        success: true;
        tx: string;
      }
    | {
        success: false;
        error: string;
        tx: string;
      };
}

export type PluginWorkerMessage =
  | PluginWorkerLoadMessage
  | PluginWorkerCreateNodesMessage
  | PluginCreateDependenciesMessage
  | PluginWorkerProcessProjectGraphMessage;

export type PluginWorkerResult =
  | PluginWorkerLoadResult
  | PluginWorkerCreateNodesResult
  | PluginCreateDependenciesResult
  | PluginWorkerProcessProjectGraphResult;

type MaybePromise<T> = T | Promise<T>;

// The handler can return a message to be sent back to the process from which the message originated
type MessageHandlerReturn<T extends PluginWorkerMessage | PluginWorkerResult> =
  T extends PluginWorkerResult
    ? MaybePromise<PluginWorkerMessage | void>
    : MaybePromise<PluginWorkerResult | void>;

// Takes a message and a map of handlers and calls the appropriate handler
// type safe and requires all handlers to be handled
export async function consumeMessage<
  T extends PluginWorkerMessage | PluginWorkerResult
>(
  raw: string | T,
  handlers: {
    [K in T['type']]: (
      // Extract restricts the type of payload to the payload of the message with the type K
      payload: Extract<T, { type: K }>['payload']
    ) => MessageHandlerReturn<T>;
  }
) {
  const message: T = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const handler = handlers[message.type];
  if (handler) {
    const response = await handler(message.payload);
    if (response) {
      process.send!(createMessage(response));
    }
  } else {
    throw new Error(`Unhandled message type: ${message.type}`);
  }
}

export function createMessage(
  message: PluginWorkerMessage | PluginWorkerResult
): string {
  return JSON.stringify(message);
}
