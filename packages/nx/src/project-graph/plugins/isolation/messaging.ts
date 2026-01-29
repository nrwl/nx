import type { Serializable } from 'child_process';
import type { Socket } from 'net';
import type { PluginConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import { MESSAGE_END_SEQ } from '../../../utils/consume-messages-from-socket';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import type {
  CreateDependenciesContext,
  CreateMetadataContext,
  CreateNodesContextV2,
  PostTasksExecutionContext,
  PreTasksExecutionContext,
} from '../public-api';

interface BaseMessage {
  tx: string;
}

export type AnyMessage = PluginWorkerMessage | PluginWorkerResult;

type Message<TType, TPayload> = BaseMessage & {
  type: TType;
  payload: TPayload;
};

export type PluginWorkerLoadMessage = Message<
  'load',
  {
    plugin: PluginConfiguration;
    root: string;
    name: string;
    pluginPath: string;
    shouldRegisterTSTranspiler: boolean;
  }
>;

export type PluginWorkerLoadResult = Message<
  'loadResult',
  | {
      name: string;
      include?: string[];
      exclude?: string[];
      createNodesPattern: string;
      hasCreateDependencies: boolean;
      hasProcessProjectGraph: boolean;
      hasCreateMetadata: boolean;
      hasPreTasksExecution: boolean;
      hasPostTasksExecution: boolean;
      success: true;
    }
  | {
      success: false;
      error: Error;
    }
>;

export type PluginWorkerCreateNodesMessage = Message<
  'createNodes',
  {
    configFiles: string[];
    context: CreateNodesContextV2;
  }
>;

export type PluginWorkerCreateNodesResult = Message<
  'createNodesResult',
  | {
      success: true;
      result: Awaited<ReturnType<LoadedNxPlugin['createNodes'][1]>>;
    }
  | {
      success: false;
      error: Error;
    }
>;

export type PluginCreateDependenciesMessage = Message<
  'createDependencies',
  {
    context: CreateDependenciesContext;
  }
>;

export type PluginCreateMetadataMessage = Message<
  'createMetadata',
  {
    graph: ProjectGraph;
    context: CreateMetadataContext;
  }
>;

export type PluginCreateDependenciesResult = Message<
  'createDependenciesResult',
  | {
      dependencies: Awaited<ReturnType<LoadedNxPlugin['createDependencies']>>;
      success: true;
    }
  | {
      success: false;
      error: Error;
    }
>;

export type PluginCreateMetadataResult = Message<
  'createMetadataResult',
  | {
      metadata: Awaited<ReturnType<LoadedNxPlugin['createMetadata']>>;
      success: true;
    }
  | {
      success: false;
      error: Error;
    }
>;

export type PluginWorkerPreTasksExecutionMessage = Message<
  'preTasksExecution',
  {
    context: PreTasksExecutionContext;
  }
>;

export type PluginWorkerPreTasksExecutionMessageResult = Message<
  'preTasksExecutionResult',
  | {
      success: true;
      mutations: NodeJS.ProcessEnv;
    }
  | {
      success: false;
      error: Error;
    }
>;

export type PluginWorkerPostTasksExecutionMessage = Message<
  'postTasksExecution',
  {
    context: PostTasksExecutionContext;
  }
>;

export type PluginWorkerPostTasksExecutionMessageResult = Message<
  'postTasksExecutionResult',
  | {
      success: true;
    }
  | {
      success: false;
      error: Error;
    }
>;

export type PluginWorkerMessage =
  | PluginWorkerLoadMessage
  | PluginWorkerCreateNodesMessage
  | PluginCreateDependenciesMessage
  | PluginCreateMetadataMessage
  | PluginWorkerPreTasksExecutionMessage
  | PluginWorkerPostTasksExecutionMessage;

export type PluginWorkerResult =
  | PluginWorkerLoadResult
  | PluginWorkerCreateNodesResult
  | PluginCreateDependenciesResult
  | PluginCreateMetadataResult
  | PluginWorkerPreTasksExecutionMessageResult
  | PluginWorkerPostTasksExecutionMessageResult;

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
      'createMetadata',
      'processProjectGraph',
      'shutdown',
      'preTasksExecution',
      'postTasksExecution',
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
      'loadResult',
      'createNodesResult',
      'createDependenciesResult',
      'processProjectGraphResult',
      'createMetadataResult',
      'preTasksExecutionResult',
      'postTasksExecutionResult',
    ].includes(message.type)
  );
}

type MaybePromise<T> = T | Promise<T>;

type MessageHandlerReturn<
  T extends (PluginWorkerMessage | PluginWorkerResult)['type'],
> = T extends PluginWorkerMessage['type']
  ? // The handler can return a message to be sent back to the process from which the message originated
    MaybePromise<Omit<MessageResult<T>, 'tx'> | void>
  : // Currently, the result handlers in plugin-worker-connection do not send messages back
    MaybePromise<void>;

export type MessageResult<T extends PluginWorkerMessage['type']> = {
  [K in PluginWorkerResult['type']]: K extends `${T}Result`
    ? Extract<PluginWorkerResult, { type: K }>
    : never;
}[`${T}Result`];

// Takes a message and a map of handlers and calls the appropriate handler
// type safe and requires all handlers to be handled
export async function consumeMessage<T extends AnyMessage>(
  socket: Socket,
  raw: T,
  handlers: {
    [K in T['type']]: (
      // Extract restricts the type of payload to the payload of the message with the type K
      payload: Extract<T, { type: K }>['payload']
    ) => MessageHandlerReturn<K>;
  }
) {
  const message: T = raw;
  const handler = handlers[message.type];
  if (handler) {
    const response = await handler(message.payload);
    if (response) {
      sendMessageOverSocket(socket, { ...response, tx: message.tx });
    }
  }
}

export function sendMessageOverSocket(
  socket: Socket,
  message: PluginWorkerMessage | PluginWorkerResult
) {
  socket.write(JSON.stringify(message) + MESSAGE_END_SEQ);
}
