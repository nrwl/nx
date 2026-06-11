"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORCE_SHUTDOWN = void 0;
exports.isHandleForceShutdownMessage = isHandleForceShutdownMessage;
exports.FORCE_SHUTDOWN = 'FORCE_SHUTDOWN';
function isHandleForceShutdownMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.FORCE_SHUTDOWN);
}
