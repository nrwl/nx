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
import type {
  AllMessages,
  AllResults,
  DefineMessages,
  Handlers,
  MaybePromise,
  ResultOf,
  WithResult,
} from './message-types';

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

/** Result type for the load message */
export type PluginWorkerLoadResult = ResultOf<PluginMessageDefs, 'load'>;

/**
 * Maps a message type to its result type.
 * e.g., MessageResult<'createNodes'> gives the createNodes result type
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
