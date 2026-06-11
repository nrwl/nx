"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_NX_WORKSPACE_FILES = void 0;
exports.isHandleNxWorkspaceFilesMessage = isHandleNxWorkspaceFilesMessage;
exports.GET_NX_WORKSPACE_FILES = 'GET_NX_WORKSPACE_FILES';
function isHandleNxWorkspaceFilesMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_NX_WORKSPACE_FILES);
}
