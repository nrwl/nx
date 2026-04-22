import type { Socket } from 'net';
import { MESSAGE_END_SEQ } from '../../utils/consume-messages-from-socket';
import { ProgressTopic } from '../../utils/progress-topics';
import { isOnDaemon } from '../is-on-daemon';
import { serverLogger } from '../logger';
import {
  EMIT_LOG,
  EmitLogLevel,
  EmitLogMessage,
  UPDATE_PROGRESS_MESSAGE,
} from '../message-types/streaming-messages';
import { serialize } from '../socket-utils';

const topicSubscribers = new Map<ProgressTopic, Set<Socket>>();

export function subscribeClientToTopic(
  socket: Socket,
  topic: ProgressTopic
): void {
  let subscribers = getTopicSubscribers(topic);
  if (!subscribers) {
    subscribers = new Set();
    topicSubscribers.set(topic, subscribers);
  }
  subscribers.add(socket);
}

export function unsubscribeClientFromTopic(
  socket: Socket,
  topic: ProgressTopic
): void {
  const subscribers = getTopicSubscribers(topic);
  if (!subscribers) return;
  subscribers.delete(socket);
}

export function getTopicSubscribers(topic: ProgressTopic): Set<Socket> {
  const subscribers = topicSubscribers.get(topic);
  if (!subscribers) {
    const set = new Set<Socket>();
    topicSubscribers.set(topic, set);
    return set;
  }
  return subscribers;
}

export function assertOnDaemon(helperName: string) {
  if (!isOnDaemon()) {
    throw new Error(
      `${helperName} can only be called from the Nx daemon process.`
    );
  }
}

/**
 * Writes a streaming message over the given socket using the daemon's
 * configured serialization format and terminated with MESSAGE_END_SEQ.
 * Errors are logged to the daemon's stdout (redirected to the daemon
 * log) rather than propagated — a disconnected client shouldn't tear
 * down the current request handler or other subscribers.
 */
export function writeStreamingMessage(
  socket: Socket,
  payload: unknown,
  description: string
) {
  try {
    serverLogger.log('Streaming message to client:', description);
    socket.write(serialize(payload) + MESSAGE_END_SEQ, (err) => {
      if (err) {
        console.log(
          `Streaming message write error (client likely disconnected): ${err.message}`
        );
      }
    });
  } catch (e) {
    console.log(
      `Failed to send streaming message to client: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

/**
 * Broadcasts a progress message to every client currently subscribed to
 * the given topic. No-op when there are no subscribers.
 *
 * Must only be invoked from inside the Nx daemon process.
 */
export function sendProgressMessageToTopic(
  topic: ProgressTopic,
  message: string
): void {
  assertOnDaemon('sendProgressMessageToTopic');
  const subscribers = getTopicSubscribers(topic);
  if (!subscribers?.size) return;
  const payload = { type: UPDATE_PROGRESS_MESSAGE, message };
  for (const socket of subscribers) {
    writeStreamingMessage(
      socket,
      payload,
      'progress update for topic ' + topic
    );
  }
}

export function sendEmitLogMessageToTopic(
  topic: ProgressTopic,
  message: string,
  level: EmitLogLevel
): void {
  assertOnDaemon('sendEmitLogMessageToTopic');
  const subscribers = getTopicSubscribers(topic);
  if (!subscribers?.size) return;
  const payload: EmitLogMessage = { type: EMIT_LOG, message, level };
  for (const socket of subscribers) {
    writeStreamingMessage(socket, payload, 'emit log message to ' + topic);
  }
}
