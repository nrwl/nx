"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_FILES_IN_DIRECTORY = void 0;
exports.isHandleGetFilesInDirectoryMessage = isHandleGetFilesInDirectoryMessage;
exports.GET_FILES_IN_DIRECTORY = 'GET_FILES_IN_DIRECTORY';
function isHandleGetFilesInDirectoryMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_FILES_IN_DIRECTORY);
}
