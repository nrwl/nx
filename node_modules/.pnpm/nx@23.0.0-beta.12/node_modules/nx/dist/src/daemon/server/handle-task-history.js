"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRecordTaskRuns = handleRecordTaskRuns;
exports.handleGetFlakyTasks = handleGetFlakyTasks;
exports.handleGetEstimatedTaskTimings = handleGetEstimatedTaskTimings;
const task_history_1 = require("../../utils/task-history");
async function handleRecordTaskRuns(taskRuns) {
    const taskHistory = (0, task_history_1.getTaskHistory)();
    await taskHistory.recordTaskRuns(taskRuns);
    return {
        response: 'true',
        description: 'handleRecordTaskRuns',
    };
}
async function handleGetFlakyTasks(hashes) {
    const taskHistory = (0, task_history_1.getTaskHistory)();
    const history = await taskHistory.getFlakyTasks(hashes);
    return {
        response: history,
        description: 'handleGetFlakyTasks',
    };
}
async function handleGetEstimatedTaskTimings(targets) {
    const taskHistory = (0, task_history_1.getTaskHistory)();
    const history = await taskHistory.getEstimatedTaskTimings(targets);
    return {
        response: history,
        description: 'handleGetEstimatedTaskTimings',
    };
}
