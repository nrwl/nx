import type { Socket } from 'net';
import { PluginWorkerEmitLogNotification } from './messaging';
export declare function setPluginWorkerHostSocket(socket: Socket): void;
/**
 * Emits a log line from the plugin worker up to its host. The host
 * decides where it ends up (direct stdout/stderr when running under the
 * CLI, forwarded to the active daemon client when running under the
 * daemon).
 *
 * When plugin isolation is turned off, or this is otherwise called
 * outside of a connected plugin worker, the message is written
 * directly to stdout/stderr so the log line isn't silently dropped.
 */
export declare function emitPluginWorkerLog(level: PluginWorkerEmitLogNotification['level'], message: string): void;
