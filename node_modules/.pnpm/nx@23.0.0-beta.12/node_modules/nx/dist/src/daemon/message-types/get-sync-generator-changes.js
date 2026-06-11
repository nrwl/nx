"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_SYNC_GENERATOR_CHANGES = void 0;
exports.isHandleGetSyncGeneratorChangesMessage = isHandleGetSyncGeneratorChangesMessage;
exports.GET_SYNC_GENERATOR_CHANGES = 'GET_SYNC_GENERATOR_CHANGES';
function isHandleGetSyncGeneratorChangesMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_SYNC_GENERATOR_CHANGES);
}
