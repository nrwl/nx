/**
 * Unified logger for daemon server and client.
 *
 * To improve the overall readability of the logs, we categorize things by "trigger":
 *
 * - [REQUEST] meaning that the current set of actions were triggered by a client request to the server
 * - [WATCHER] meaning the current set of actions were triggered by handling changes to the workspace files
 *
 * We keep those two "triggers" left aligned at the top level and then indent subsequent logs so that there is a
 * logical hierarchy/grouping.
 */
import { ProgressTopic } from '../utils/progress-topics';
import { EmitLogLevel } from './message-types/streaming-messages';
type LogSource = 'Server' | 'Client';
declare class DaemonLogger {
    private source;
    constructor(source: LogSource);
    log(...s: unknown[]): void;
    requestLog(...s: unknown[]): void;
    watcherLog(...s: unknown[]): void;
    /**
     * Broadcasts a log line to every client currently subscribed to the
     * given topic. Useful for warnings raised inside daemon-executed code
     * that we want the user to see in their terminal rather than lose to
     * the daemon log file.
     *
     * Falls back to writing into the daemon log when no clients are
     * subscribed to the topic.
     *
     * Must only be invoked from inside the Nx daemon process.
     */
    logToClient(topic: ProgressTopic, message: string, level?: EmitLogLevel): void;
    private writeToFile;
    private formatLogMessage;
    private getNow;
}
export declare const serverLogger: DaemonLogger;
export declare const clientLogger: DaemonLogger;
export {};
