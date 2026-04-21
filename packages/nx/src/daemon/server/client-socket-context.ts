import type { Socket } from 'net';
import { MESSAGE_END_SEQ } from '../../utils/consume-messages-from-socket';
import { UPDATE_PROGRESS_MESSAGE } from '../message-types/streaming-messages';
import { isOnDaemon } from '../is-on-daemon';
import { serialize } from '../socket-utils';

/**
 * Named channels that clients can subscribe to in order to receive
 * streaming progress/log output produced by a long-running daemon
 * operation. A handler subscribes the requesting socket to the topics
 * it will produce output for; the broadcast helpers fan out to every
 * currently-subscribed socket for that topic.
 *
 * Add new topics here as other long-running daemon operations grow
 * their own streaming surfaces.
 */
export const ProgressTopics = {
  GraphConstruction: 'graph-construction',
} as const;
export type ProgressTopic =
  (typeof ProgressTopics)[keyof typeof ProgressTopics];

const topicSubscribers = new Map<ProgressTopic, Set<Socket>>();

export function subscribeClientToTopic(
  socket: Socket,
  topic: ProgressTopic
): void {
  let subscribers = topicSubscribers.get(topic);
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
  const subscribers = topicSubscribers.get(topic);
  if (!subscribers) return;
  subscribers.delete(socket);
  if (subscribers.size === 0) topicSubscribers.delete(topic);
}

export function getTopicSubscribers(
  topic: ProgressTopic
): ReadonlySet<Socket> | undefined {
  return topicSubscribers.get(topic);
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
export function writeStreamingMessage(socket: Socket, payload: unknown) {
  try {
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
  const subscribers = topicSubscribers.get(topic);
  if (!subscribers?.size) return;
  const payload = { type: UPDATE_PROGRESS_MESSAGE, message };
  for (const socket of subscribers) {
    writeStreamingMessage(socket, payload);
  }
}
