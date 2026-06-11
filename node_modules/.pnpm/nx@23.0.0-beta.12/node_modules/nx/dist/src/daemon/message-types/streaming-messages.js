"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMIT_LOG = exports.UPDATE_PROGRESS_MESSAGE = void 0;
exports.isUpdateProgressMessage = isUpdateProgressMessage;
exports.isEmitLogMessage = isEmitLogMessage;
exports.UPDATE_PROGRESS_MESSAGE = 'UPDATE_PROGRESS_MESSAGE';
function isUpdateProgressMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.UPDATE_PROGRESS_MESSAGE);
}
exports.EMIT_LOG = 'EMIT_LOG';
function isEmitLogMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.EMIT_LOG);
}
