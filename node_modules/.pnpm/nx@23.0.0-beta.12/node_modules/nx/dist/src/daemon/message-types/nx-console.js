"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SET_NX_CONSOLE_PREFERENCE_AND_INSTALL = exports.GET_NX_CONSOLE_STATUS = void 0;
exports.isHandleGetNxConsoleStatusMessage = isHandleGetNxConsoleStatusMessage;
exports.isHandleSetNxConsolePreferenceAndInstallMessage = isHandleSetNxConsolePreferenceAndInstallMessage;
exports.GET_NX_CONSOLE_STATUS = 'GET_NX_CONSOLE_STATUS';
exports.SET_NX_CONSOLE_PREFERENCE_AND_INSTALL = 'SET_NX_CONSOLE_PREFERENCE_AND_INSTALL';
function isHandleGetNxConsoleStatusMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_NX_CONSOLE_STATUS);
}
function isHandleSetNxConsolePreferenceAndInstallMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.SET_NX_CONSOLE_PREFERENCE_AND_INSTALL);
}
