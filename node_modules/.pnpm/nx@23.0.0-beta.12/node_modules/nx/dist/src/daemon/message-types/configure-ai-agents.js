"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESET_CONFIGURE_AI_AGENTS_STATUS = exports.GET_CONFIGURE_AI_AGENTS_STATUS = void 0;
exports.isHandleGetConfigureAiAgentsStatusMessage = isHandleGetConfigureAiAgentsStatusMessage;
exports.isHandleResetConfigureAiAgentsStatusMessage = isHandleResetConfigureAiAgentsStatusMessage;
exports.GET_CONFIGURE_AI_AGENTS_STATUS = 'GET_CONFIGURE_AI_AGENTS_STATUS';
function isHandleGetConfigureAiAgentsStatusMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_CONFIGURE_AI_AGENTS_STATUS);
}
exports.RESET_CONFIGURE_AI_AGENTS_STATUS = 'RESET_CONFIGURE_AI_AGENTS_STATUS';
function isHandleResetConfigureAiAgentsStatusMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.RESET_CONFIGURE_AI_AGENTS_STATUS);
}
