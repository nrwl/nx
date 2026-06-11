"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRunPreTasksExecution = handleRunPreTasksExecution;
exports.handleRunPostTasksExecution = handleRunPostTasksExecution;
const tasks_execution_hooks_1 = require("../../project-graph/plugins/tasks-execution-hooks");
async function handleRunPreTasksExecution(context) {
    try {
        const envs = await (0, tasks_execution_hooks_1.runPreTasksExecution)(context);
        return {
            response: envs,
            description: 'handleRunPreTasksExecution',
        };
    }
    catch (e) {
        return {
            error: e,
            description: `Error when running preTasksExecution.`,
        };
    }
}
async function handleRunPostTasksExecution(context) {
    try {
        await (0, tasks_execution_hooks_1.runPostTasksExecution)(context);
        return {
            response: 'true',
            description: 'handleRunPostTasksExecution',
        };
    }
    catch (e) {
        return {
            error: e,
            description: `Error when running postTasksExecution.`,
        };
    }
}
