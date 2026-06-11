"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_END_SEQ = void 0;
exports.consumeMessagesFromSocket = consumeMessagesFromSocket;
exports.isJsonMessage = isJsonMessage;
exports.parseMessage = parseMessage;
const string_decoder_1 = require("string_decoder");
const v8_1 = require("v8");
const VERY_END_CODE = 4;
exports.MESSAGE_END_SEQ = 'NX_MSG_END' + String.fromCharCode(VERY_END_CODE);
function consumeMessagesFromSocket(callback) {
    let message = '';
    const decoder = new string_decoder_1.StringDecoder('utf8');
    return (data) => {
        const chunk = decoder.write(data);
        message += chunk;
        // Check if accumulated message ends with MESSAGE_END_SEQ (not just the chunk)
        // This handles TCP packet fragmentation where MESSAGE_END_SEQ may be split across packets
        if (chunk.codePointAt(chunk.length - 1) === VERY_END_CODE &&
            message.endsWith(exports.MESSAGE_END_SEQ)) {
            // Remove the trailing MESSAGE_END_SEQ
            const fullMessage = message.substring(0, message.length - exports.MESSAGE_END_SEQ.length);
            // Server may send multiple messages in one chunk, so splitting by MESSAGE_END_SEQ
            const messages = fullMessage.split(exports.MESSAGE_END_SEQ);
            for (const splitMessage of messages) {
                if (splitMessage) {
                    callback(splitMessage);
                }
            }
            message = '';
        }
        // If message doesn't end with MESSAGE_END_SEQ, keep accumulating chunks
    };
}
function isJsonMessage(message) {
    return (
    // json objects
    ['[', '{'].some((prefix) => message.startsWith(prefix)) ||
        // booleans
        message === 'true' ||
        message === 'false' ||
        // strings
        (message.startsWith('"') && message.endsWith('"')) ||
        // numbers
        /^[0-9]+(\.?[0-9]+)?$/.test(message));
}
/**
 * Parse a message that was produced by `serialize()` in
 * `daemon/socket-utils.ts`. Auto-detects JSON vs. v8-serialized payloads using
 * `isJsonMessage()` and decodes the binary path via `v8.deserialize`.
 */
function parseMessage(message) {
    return isJsonMessage(message)
        ? JSON.parse(message)
        : (0, v8_1.deserialize)(Buffer.from(message, 'binary'));
}
