"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskHistory = void 0;
exports.getTaskHistory = getTaskHistory;
const client_1 = require("../daemon/client/client");
const is_on_daemon_1 = require("../daemon/is-on-daemon");
const native_1 = require("../native");
const db_connection_1 = require("./db-connection");
class TaskHistory {
    constructor() {
        this.taskHistory = new native_1.NxTaskHistory((0, db_connection_1.getDbConnection)());
    }
    /**
     * This function returns estimated timings per task
     * @param targets
     * @returns a map where key is task id (project:target:configuration), value is average time of historical runs
     */
    async getEstimatedTaskTimings(targets) {
        if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
            return this.taskHistory.getEstimatedTaskTimings(targets);
        }
        return await client_1.daemonClient.getEstimatedTaskTimings(targets);
    }
    async getFlakyTasks(hashes) {
        if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
            return this.taskHistory.getFlakyTasks(hashes);
        }
        return await client_1.daemonClient.getFlakyTasks(hashes);
    }
    async recordTaskRuns(taskRuns) {
        if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
            return this.taskHistory.recordTaskRuns(taskRuns);
        }
        return client_1.daemonClient.recordTaskRuns(taskRuns);
    }
}
exports.TaskHistory = TaskHistory;
let taskHistory;
/**
 * This function returns the singleton instance of TaskHistory
 * @returns singleton instance of TaskHistory, null if database is disabled or WASM is enabled
 */
function getTaskHistory() {
    if (native_1.IS_WASM) {
        return null;
    }
    if (!taskHistory) {
        taskHistory = new TaskHistory();
    }
    return taskHistory;
}
