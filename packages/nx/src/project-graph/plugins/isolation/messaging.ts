import { ProjectGraph } from '../../../config/project-graph';
import { PluginConfiguration } from '../../../config/nx-json';
import {
  CreateDependenciesContext,
  CreateMetadataContext,
  CreateNodesContextV2,
} from '../public-api';
import { LoadedNxPlugin } from '../internal-api';
import { Serializable } from 'child_process';
import { Socket } from 'net';

export interface PluginWorkerLoadMessage {
  type: 'load';
  payload: {
    plugin: PluginConfiguration;
    root: string;
    name: string;
    pluginPath: string;
    shouldRegisterTSTranspiler: boolean;
  };
}

export interface PluginWorkerLoadResult {
  type: 'load-result';
  payload:
    | {
        name: string;
        include?: string[];
        exclude?: string[];
        createNodesPattern: string;
        hasCreateDependencies: boolean;
        hasProcessProjectGraph: boolean;
        hasCreateMetadata: boolean;
        success: true;
      }
    | {
        success: false;
        error: Error;
      };
}

export interface PluginWorkerCreateNodesMessage {
  type: 'createNodes';
  payload: {
    configFiles: string[];
    context: CreateNodesContextV2;
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
        error: Error;
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

export interface PluginCreateMetadataMessage {
  type: 'createMetadata';
  payload: {
    graph: ProjectGraph;
    context: CreateMetadataContext;
    tx: string;
  };
}

export interface PluginCreateDependenciesResult {
  type: 'createDependenciesResult';
  payload:
    | {
        dependencies: Awaited<ReturnType<LoadedNxPlugin['createDependencies']>>;
        success: true;
        tx: string;
      }
    | {
        success: false;
        error: Error;
        tx: string;
      };
}

export interface PluginCreateMetadataResult {
  type: 'createMetadataResult';
  payload:
    | {
        metadata: Awaited<ReturnType<LoadedNxPlugin['createMetadata']>>;
        success: true;
        tx: string;
      }
    | {
        success: false;
        error: Error;
        tx: string;
      };
}

export type PluginWorkerMessage =
  | PluginWorkerLoadMessage
  | PluginWorkerCreateNodesMessage
  | PluginCreateDependenciesMessage
  | PluginCreateMetadataMessage;

export type PluginWorkerResult =
  | PluginWorkerLoadResult
  | PluginWorkerCreateNodesResult
  | PluginCreateDependenciesResult
  | PluginCreateMetadataResult;

export function isPluginWorkerMessage(
  message: Serializable
): message is PluginWorkerMessage {
  return (
    typeof message === 'object' &&
    'type' in message &&
    typeof message.type === 'string' &&
    [
      'load',
      'createNodes',
      'createDependencies',
      'processProjectGraph',
      'createMetadata',
      'shutdown',
    ].includes(message.type)
  );
}

export function isPluginWorkerResult(
  message: Serializable
): message is PluginWorkerResult {
  return (
    typeof message === 'object' &&
    'type' in message &&
    typeof message.type === 'string' &&
    [
      'load-result',
      'createNodesResult',
      'createDependenciesResult',
      'processProjectGraphResult',
      'createMetadataResult',
    ].includes(message.type)
  );
}

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
  socket: Socket,
  raw: T,
  handlers: {
    [K in T['type']]: (
      // Extract restricts the type of payload to the payload of the message with the type K
      payload: Extract<T, { type: K }>['payload']
    ) => MessageHandlerReturn<T>;
  }
) {
  const message: T = raw;
  const handler = handlers[message.type];
  if (handler) {
    const response = await handler(message.payload);
    if (response) {
      sendMessageOverSocket(socket, response);
    }
  }
}

export function sendMessageOverSocket(
  socket: Socket,
  message: PluginWorkerMessage | PluginWorkerResult
) {
  socket.write(JSON.stringify(message) + String.fromCodePoint(4));
}
