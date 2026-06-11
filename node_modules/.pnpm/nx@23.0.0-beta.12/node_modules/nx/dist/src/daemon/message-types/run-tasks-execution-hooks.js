"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST_TASKS_EXECUTION = exports.PRE_TASKS_EXECUTION = void 0;
exports.isHandlePreTasksExecutionMessage = isHandlePreTasksExecutionMessage;
exports.isHandlePostTasksExecutionMessage = isHandlePostTasksExecutionMessage;
exports.PRE_TASKS_EXECUTION = 'PRE_TASKS_EXECUTION';
exports.POST_TASKS_EXECUTION = 'POST_TASKS_EXECUTION';
function isHandlePreTasksExecutionMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.PRE_TASKS_EXECUTION);
}
function isHandlePostTasksExecutionMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.POST_TASKS_EXECUTION);
}
