"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPDATE_WORKSPACE_CONTEXT = void 0;
exports.isHandleUpdateWorkspaceContextMessage = isHandleUpdateWorkspaceContextMessage;
exports.UPDATE_WORKSPACE_CONTEXT = 'UPDATE_WORKSPACE_CONTEXT';
function isHandleUpdateWorkspaceContextMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.UPDATE_WORKSPACE_CONTEXT);
}
