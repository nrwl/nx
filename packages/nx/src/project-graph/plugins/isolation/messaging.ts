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

// =============================================================================
// CORE TYPE SYSTEM
// =============================================================================

interface BaseMessage {
  tx: string;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Constraint for message definitions.
 * - payload: required, the message payload
 * - result: optional, if present this message expects a response
 */
type MessageDef = {
  payload: unknown;
  result?: unknown;
};

type MessageDefs = Record<string, MessageDef>;

/**
 * DefineMessages<T> - purely a type-level construct for defining
 * a set of related messages with their payloads and optional results.
 */
type DefineMessages<TDefs extends MessageDefs> = TDefs;

// =============================================================================
// TYPE EXTRACTION HELPERS
// =============================================================================

/** Get keys that have results defined */
type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

/** Extract the full message type for a given key */
type MessageOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs,
> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

/** Extract the full result type for a given key */
type ResultOf<
  TDefs extends MessageDefs,
  K extends WithResult<TDefs>,
> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K]['result'];
};

/** Union of all message types */
type AllMessages<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: MessageOf<TDefs, K>;
}[keyof TDefs & string];

/** Union of all result types */
type AllResults<TDefs extends MessageDefs> = {
  [K in WithResult<TDefs> & string]: ResultOf<TDefs, K>;
}[WithResult<TDefs> & string];

/**
 * Handler map type - handlers return just the result payload directly.
 * The infrastructure wraps the return value in { type: '${key}Result', payload, tx }.
 */
type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};

// =============================================================================
// PLUGIN MESSAGE DEFINITIONS
// =============================================================================

/**
 * All plugin worker message definitions in one place.
 * Each entry defines:
 * - payload: what the message carries
 * - result (optional): what the response carries
 */
type PluginMessageDefs = DefineMessages<{
  load: {
    payload: {
      plugin: PluginConfiguration;
      root: string;
      name: string;
      pluginPath: string;
      shouldRegisterTSTranspiler: boolean;
    };
    result:
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
        };
  };

  createNodes: {
    payload: {
      configFiles: string[];
      context: CreateNodesContextV2;
    };
    result:
      | {
          success: true;
          result: Awaited<ReturnType<LoadedNxPlugin['createNodes'][1]>>;
        }
      | {
          success: false;
          error: Error;
        };
  };

  createDependencies: {
    payload: {
      context: CreateDependenciesContext;
    };
    result:
      | {
          dependencies: Awaited<
            ReturnType<LoadedNxPlugin['createDependencies']>
          >;
          success: true;
        }
      | {
          success: false;
          error: Error;
        };
  };

  createMetadata: {
    payload: {
      graph: ProjectGraph;
      context: CreateMetadataContext;
    };
    result:
      | {
          metadata: Awaited<ReturnType<LoadedNxPlugin['createMetadata']>>;
          success: true;
        }
      | {
          success: false;
          error: Error;
        };
  };

  preTasksExecution: {
    payload: {
      context: PreTasksExecutionContext;
    };
    result:
      | {
          success: true;
          mutations: NodeJS.ProcessEnv;
        }
      | {
          success: false;
          error: Error;
        };
  };

  postTasksExecution: {
    payload: {
      context: PostTasksExecutionContext;
    };
    result:
      | {
          success: true;
        }
      | {
          success: false;
          error: Error;
        };
  };
}>;

// =============================================================================
// EXPORTED TYPES (derived from PluginMessageDefs)
// =============================================================================

/** Union of all plugin worker message types */
export type PluginWorkerMessage = AllMessages<PluginMessageDefs>;

/** Union of all plugin worker result types */
export type PluginWorkerResult = AllResults<PluginMessageDefs>;

/** Any message (request or result) */
export type AnyMessage = PluginWorkerMessage | PluginWorkerResult;

/** Individual message types (for explicit typing when needed) */
export type PluginWorkerLoadMessage = MessageOf<PluginMessageDefs, 'load'>;
export type PluginWorkerCreateNodesMessage = MessageOf<
  PluginMessageDefs,
  'createNodes'
>;
export type PluginCreateDependenciesMessage = MessageOf<
  PluginMessageDefs,
  'createDependencies'
>;
export type PluginCreateMetadataMessage = MessageOf<
  PluginMessageDefs,
  'createMetadata'
>;
export type PluginWorkerPreTasksExecutionMessage = MessageOf<
  PluginMessageDefs,
  'preTasksExecution'
>;
export type PluginWorkerPostTasksExecutionMessage = MessageOf<
  PluginMessageDefs,
  'postTasksExecution'
>;

/** Individual result types (for explicit typing when needed) */
export type PluginWorkerLoadResult = ResultOf<PluginMessageDefs, 'load'>;
export type PluginWorkerCreateNodesResult = ResultOf<
  PluginMessageDefs,
  'createNodes'
>;
export type PluginCreateDependenciesResult = ResultOf<
  PluginMessageDefs,
  'createDependencies'
>;
export type PluginCreateMetadataResult = ResultOf<
  PluginMessageDefs,
  'createMetadata'
>;
export type PluginWorkerPreTasksExecutionMessageResult = ResultOf<
  PluginMessageDefs,
  'preTasksExecution'
>;
export type PluginWorkerPostTasksExecutionMessageResult = ResultOf<
  PluginMessageDefs,
  'postTasksExecution'
>;

/**
 * Maps a message type to its result type.
 * e.g., MessageResult<'createNodes'> gives PluginWorkerCreateNodesResult
 */
export type MessageResult<T extends PluginWorkerMessage['type']> = ResultOf<
  PluginMessageDefs,
  T & WithResult<PluginMessageDefs>
>;

// =============================================================================
// TYPE GUARDS
// =============================================================================

const MESSAGE_TYPES: ReadonlyArray<PluginWorkerMessage['type']> = [
  'load',
  'createNodes',
  'createDependencies',
  'createMetadata',
  'preTasksExecution',
  'postTasksExecution',
];

const RESULT_TYPES: ReadonlyArray<PluginWorkerResult['type']> = [
  'loadResult',
  'createNodesResult',
  'createDependenciesResult',
  'createMetadataResult',
  'preTasksExecutionResult',
  'postTasksExecutionResult',
];

export function isPluginWorkerMessage(
  message: Serializable
): message is PluginWorkerMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof message.type === 'string' &&
    (MESSAGE_TYPES as readonly string[]).includes(message.type)
  );
}

export function isPluginWorkerResult(
  message: Serializable
): message is PluginWorkerResult {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof message.type === 'string' &&
    (RESULT_TYPES as readonly string[]).includes(message.type)
  );
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

/**
 * Consumes a message and dispatches to the appropriate handler.
 * If the handler returns a value, it's automatically wrapped in a result message
 * with the correct type and transaction ID.
 *
 * Handlers return just the result payload - the infrastructure handles wrapping.
 */
export async function consumeMessage(
  socket: Socket,
  raw: PluginWorkerMessage,
  handlers: Handlers<PluginMessageDefs>
): Promise<void> {
  const message = raw;
  const type = message.type as keyof PluginMessageDefs & string;

  const handler = handlers[type];

  // Type widening for dynamic dispatch - safe because types guarantee
  // message.type always indexes into the matching handler
  const resultPayload = await (
    handler as (
      payload: PluginWorkerMessage['payload']
    ) => MaybePromise<unknown>
  )(message.payload);

  if (resultPayload !== undefined && resultPayload !== null) {
    sendMessageOverSocket(socket, {
      type: `${type}Result` as PluginWorkerResult['type'],
      payload: resultPayload,
      tx: message.tx,
    } as PluginWorkerResult);
  }
}

/**
 * Sends a message over the socket with proper formatting.
 */
export function sendMessageOverSocket(
  socket: Socket,
  message: PluginWorkerMessage | PluginWorkerResult
): void {
  socket.write(JSON.stringify(message) + MESSAGE_END_SEQ);
}
