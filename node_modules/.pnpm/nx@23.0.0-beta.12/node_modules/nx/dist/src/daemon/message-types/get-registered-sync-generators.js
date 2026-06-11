"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_REGISTERED_SYNC_GENERATORS = void 0;
exports.isHandleGetRegisteredSyncGeneratorsMessage = isHandleGetRegisteredSyncGeneratorsMessage;
exports.GET_REGISTERED_SYNC_GENERATORS = 'GET_REGISTERED_SYNC_GENERATORS';
function isHandleGetRegisteredSyncGeneratorsMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_REGISTERED_SYNC_GENERATORS);
}
