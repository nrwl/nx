"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGISTER_PROJECT_GRAPH_LISTENER = void 0;
exports.isRegisterProjectGraphListenerMessage = isRegisterProjectGraphListenerMessage;
exports.REGISTER_PROJECT_GRAPH_LISTENER = 'REGISTER_PROJECT_GRAPH_LISTENER';
function isRegisterProjectGraphListenerMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.REGISTER_PROJECT_GRAPH_LISTENER);
}
