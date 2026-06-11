"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTI_GLOB = exports.GLOB = void 0;
exports.isHandleGlobMessage = isHandleGlobMessage;
exports.isHandleMultiGlobMessage = isHandleMultiGlobMessage;
exports.GLOB = 'GLOB';
function isHandleGlobMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GLOB);
}
exports.MULTI_GLOB = 'MULTI_GLOB';
function isHandleMultiGlobMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.MULTI_GLOB);
}
