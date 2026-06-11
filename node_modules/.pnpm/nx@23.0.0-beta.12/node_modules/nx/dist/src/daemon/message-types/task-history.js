"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECORD_TASK_RUNS = exports.GET_ESTIMATED_TASK_TIMINGS = exports.GET_FLAKY_TASKS = void 0;
exports.isHandleGetFlakyTasksMessage = isHandleGetFlakyTasksMessage;
exports.isHandleGetEstimatedTaskTimings = isHandleGetEstimatedTaskTimings;
exports.isHandleWriteTaskRunsToHistoryMessage = isHandleWriteTaskRunsToHistoryMessage;
exports.GET_FLAKY_TASKS = 'GET_FLAKY_TASKS';
exports.GET_ESTIMATED_TASK_TIMINGS = 'GET_ESTIMATED_TASK_TIMINGS';
exports.RECORD_TASK_RUNS = 'RECORD_TASK_RUNS';
function isHandleGetFlakyTasksMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_FLAKY_TASKS);
}
function isHandleGetEstimatedTaskTimings(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.GET_ESTIMATED_TASK_TIMINGS);
}
function isHandleWriteTaskRunsToHistoryMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.RECORD_TASK_RUNS);
}
