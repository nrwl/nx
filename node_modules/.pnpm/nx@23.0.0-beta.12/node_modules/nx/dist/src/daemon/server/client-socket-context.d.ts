import type { Socket } from 'net';
import { ProgressTopic } from '../../utils/progress-topics';
import { EmitLogLevel } from '../message-types/streaming-messages';
export declare function subscribeClientToTopic(socket: Socket, topic: ProgressTopic): void;
export declare function unsubscribeClientFromTopic(socket: Socket, topic: ProgressTopic): void;
export declare function getTopicSubscribers(topic: ProgressTopic): Set<Socket>;
export declare function assertOnDaemon(helperName: string): void;
/**
 * Writes a streaming message over the given socket using the daemon's
 * configured serialization format and terminated with MESSAGE_END_SEQ.
 * Errors are logged to the daemon's stdout (redirected to the daemon
 * log) rather than propagated — a disconnected client shouldn't tear
 * down the current request handler or other subscribers.
 */
export declare function writeStreamingMessage(socket: Socket, payload: unknown, description: string): void;
/**
 * Broadcasts a progress message to every client currently subscribed to
 * the given topic. No-op when there are no subscribers.
 *
 * Must only be invoked from inside the Nx daemon process.
 */
export declare function sendProgressMessageToTopic(topic: ProgressTopic, message: string): void;
export declare function sendEmitLogMessageToTopic(topic: ProgressTopic, message: string, level: EmitLogLevel): void;
