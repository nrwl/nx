import { Server } from 'net';
import type { WatchEvent } from '../../native';
export type FileWatcherCallback = (err: Error | string | null, changeEvents: WatchEvent[] | null) => Promise<void>;
export declare function watchWorkspace(server: Server, cb: FileWatcherCallback): Promise<any>;
/**
 * Synchronously drain anything the workspace watcher has buffered and feed
 * it through the normal change-handling pipeline. Call this before serving
 * a cached project graph so we never return data that the watcher has
 * already seen invalidated but hasn't flushed yet.
 */
export declare function flushPendingWorkspaceChanges(): Promise<void>;
export declare function watchOutputFiles(server: Server, cb: FileWatcherCallback): Promise<any>;
/**
 * NOTE: An event type of "create" will also apply to the case where the user has restored
 * an original version of a file after modifying/deleting it by using git, so we adjust
 * our log language accordingly.
 */
export declare function convertChangeEventsToLogMessage(changeEvents: WatchEvent[]): string;
