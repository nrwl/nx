import type { Serializable } from 'child_process';
import type { Socket } from 'net';
import type { PluginConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
import type { CreateDependenciesContext, CreateMetadataContext, CreateNodesContextV2, PostTasksExecutionContext, PreTasksExecutionContext } from '../public-api';
import type { AllMessages, AllResults, DefineMessages, Handlers, ResultOf, WithResult } from './message-types';
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
        result: {
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
        } | {
            success: false;
            error: Error;
        };
    };
    createNodes: {
        payload: {
            configFiles: string[];
            context: CreateNodesContextV2;
        };
        result: {
            success: true;
            result: Awaited<ReturnType<LoadedNxPlugin['createNodes'][1]>>;
        } | {
            success: false;
            error: Error;
        };
    };
    createDependencies: {
        payload: {
            context: CreateDependenciesContext;
        };
        result: {
            dependencies: Awaited<ReturnType<LoadedNxPlugin['createDependencies']>>;
            success: true;
        } | {
            success: false;
            error: Error;
        };
    };
    createMetadata: {
        payload: {
            graph: ProjectGraph;
            context: CreateMetadataContext;
        };
        result: {
            metadata: Awaited<ReturnType<LoadedNxPlugin['createMetadata']>>;
            success: true;
        } | {
            success: false;
            error: Error;
        };
    };
    preTasksExecution: {
        payload: {
            context: PreTasksExecutionContext;
        };
        result: {
            success: true;
            mutations: NodeJS.ProcessEnv;
        } | {
            success: false;
            error: Error;
        };
    };
    postTasksExecution: {
        payload: {
            context: PostTasksExecutionContext;
        };
        result: {
            success: true;
        } | {
            success: false;
            error: Error;
        };
    };
    setWorkerEnv: {
        payload: Record<string, string>;
        result: {
            success: true;
        } | {
            success: false;
            error: Error;
        };
    };
}>;
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
export type MessageResult<T extends PluginWorkerMessage['type']> = ResultOf<PluginMessageDefs, T & WithResult<PluginMessageDefs>>;
export type PluginWorkerEmitLogNotification = {
    type: 'emitLog';
    level: 'log' | 'warn' | 'error';
    message: string;
};
export type PluginWorkerNotification = PluginWorkerEmitLogNotification;
export declare function isPluginWorkerNotification(message: Serializable): message is PluginWorkerNotification;
export declare function isPluginWorkerMessage(message: Serializable): message is PluginWorkerMessage;
export declare function isPluginWorkerResult(message: Serializable): message is PluginWorkerResult;
/**
 * Consumes a message and dispatches to the appropriate handler.
 * If the handler returns a value, it's automatically wrapped in a result message
 * with the correct type and transaction ID.
 *
 * Handlers return just the result payload - the infrastructure handles wrapping.
 */
export declare function consumeMessage(socket: Socket, raw: PluginWorkerMessage, handlers: Handlers<PluginMessageDefs>): Promise<void>;
/**
 * Sends a message over the socket with proper formatting.
 */
export declare function sendMessageOverSocket(socket: Socket, message: PluginWorkerMessage | PluginWorkerResult | PluginWorkerNotification): void;
export {};
