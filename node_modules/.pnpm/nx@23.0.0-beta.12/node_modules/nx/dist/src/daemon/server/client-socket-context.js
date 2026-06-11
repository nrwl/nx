"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeClientToTopic = subscribeClientToTopic;
exports.unsubscribeClientFromTopic = unsubscribeClientFromTopic;
exports.getTopicSubscribers = getTopicSubscribers;
exports.assertOnDaemon = assertOnDaemon;
exports.writeStreamingMessage = writeStreamingMessage;
exports.sendProgressMessageToTopic = sendProgressMessageToTopic;
exports.sendEmitLogMessageToTopic = sendEmitLogMessageToTopic;
const consume_messages_from_socket_1 = require("../../utils/consume-messages-from-socket");
const is_on_daemon_1 = require("../is-on-daemon");
const logger_1 = require("../logger");
const streaming_messages_1 = require("../message-types/streaming-messages");
const socket_utils_1 = require("../socket-utils");
const topicSubscribers = new Map();
function subscribeClientToTopic(socket, topic) {
    let subscribers = getTopicSubscribers(topic);
    if (!subscribers) {
        subscribers = new Set();
        topicSubscribers.set(topic, subscribers);
    }
    subscribers.add(socket);
}
function unsubscribeClientFromTopic(socket, topic) {
    const subscribers = getTopicSubscribers(topic);
    if (!subscribers)
        return;
    subscribers.delete(socket);
}
function getTopicSubscribers(topic) {
    const subscribers = topicSubscribers.get(topic);
    if (!subscribers) {
        const set = new Set();
        topicSubscribers.set(topic, set);
        return set;
    }
    return subscribers;
}
function assertOnDaemon(helperName) {
    if (!(0, is_on_daemon_1.isOnDaemon)()) {
        throw new Error(`${helperName} can only be called from the Nx daemon process.`);
    }
}
/**
 * Writes a streaming message over the given socket using the daemon's
 * configured serialization format and terminated with MESSAGE_END_SEQ.
 * Errors are logged to the daemon's stdout (redirected to the daemon
 * log) rather than propagated — a disconnected client shouldn't tear
 * down the current request handler or other subscribers.
 */
function writeStreamingMessage(socket, payload, description) {
    try {
        logger_1.serverLogger.log('Streaming message to client:', description);
        socket.write((0, socket_utils_1.serialize)(payload) + consume_messages_from_socket_1.MESSAGE_END_SEQ, (err) => {
            if (err) {
                console.log(`Streaming message write error (client likely disconnected): ${err.message}`);
            }
        });
    }
    catch (e) {
        console.log(`Failed to send streaming message to client: ${e instanceof Error ? e.message : String(e)}`);
    }
}
/**
 * Broadcasts a progress message to every client currently subscribed to
 * the given topic. No-op when there are no subscribers.
 *
 * Must only be invoked from inside the Nx daemon process.
 */
function sendProgressMessageToTopic(topic, message) {
    assertOnDaemon('sendProgressMessageToTopic');
    const subscribers = getTopicSubscribers(topic);
    if (!subscribers?.size)
        return;
    const payload = { type: streaming_messages_1.UPDATE_PROGRESS_MESSAGE, message };
    for (const socket of subscribers) {
        writeStreamingMessage(socket, payload, 'progress update for topic ' + topic);
    }
}
function sendEmitLogMessageToTopic(topic, message, level) {
    assertOnDaemon('sendEmitLogMessageToTopic');
    const subscribers = getTopicSubscribers(topic);
    if (!subscribers?.size)
        return;
    const payload = { type: streaming_messages_1.EMIT_LOG, message, level };
    for (const socket of subscribers) {
        writeStreamingMessage(socket, payload, 'emit log message to ' + topic);
    }
}
