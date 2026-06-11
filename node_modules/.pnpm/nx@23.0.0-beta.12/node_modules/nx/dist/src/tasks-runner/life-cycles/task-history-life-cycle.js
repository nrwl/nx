"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskHistoryLifeCycle = void 0;
exports.getTasksHistoryLifeCycle = getTasksHistoryLifeCycle;
const nx_json_1 = require("../../config/nx-json");
const native_1 = require("../../native");
const nx_cloud_utils_1 = require("../../utils/nx-cloud-utils");
const output_1 = require("../../utils/output");
const serialize_target_1 = require("../../utils/serialize-target");
const task_history_1 = require("../../utils/task-history");
const is_tui_enabled_1 = require("../is-tui-enabled");
const task_history_life_cycle_old_1 = require("./task-history-life-cycle-old");
let tasksHistoryLifeCycle;
function getTasksHistoryLifeCycle() {
    if (!tasksHistoryLifeCycle) {
        tasksHistoryLifeCycle = !native_1.IS_WASM
            ? new TaskHistoryLifeCycle()
            : new task_history_life_cycle_old_1.LegacyTaskHistoryLifeCycle();
    }
    return tasksHistoryLifeCycle;
}
class TaskHistoryLifeCycle {
    constructor() {
        this.startTimings = {};
        this.pendingResults = new Map();
        this.taskRuns = new Map();
        this.taskHistory = (0, task_history_1.getTaskHistory)();
        if (tasksHistoryLifeCycle) {
            throw new Error('TaskHistoryLifeCycle is a singleton and should not be instantiated multiple times');
        }
        tasksHistoryLifeCycle = this;
    }
    startTasks(tasks) {
        for (let task of tasks) {
            this.startTimings[task.id] = new Date().getTime();
        }
    }
    async endTasks(taskResults) {
        for (const taskResult of taskResults) {
            this.pendingResults.set(taskResult.task.id, taskResult);
        }
    }
    async endCommand() {
        if (!this.taskHistory) {
            return;
        }
        // Build TaskRun objects now — task.hash is guaranteed to be set by this point
        for (const [, taskResult] of this.pendingResults) {
            this.taskRuns.set(taskResult.task.hash, {
                hash: taskResult.task.hash,
                target: taskResult.task.target,
                code: taskResult.code,
                status: taskResult.status,
                start: taskResult.task.startTime ?? this.startTimings[taskResult.task.id],
                end: taskResult.task.endTime ?? Date.now(),
                cacheable: taskResult.task.cache === true,
            });
        }
        const runs = [];
        // Only check for flaky tasks among cacheable tasks
        const cacheableHashes = [];
        const iterator = this.taskRuns.entries();
        for (const [hash, run] of iterator) {
            runs.push(run);
            if (run.cacheable) {
                cacheableHashes.push(hash);
            }
        }
        await this.taskHistory.recordTaskRuns(runs);
        this.flakyTasks =
            cacheableHashes.length > 0
                ? await this.taskHistory.getFlakyTasks(cacheableHashes)
                : [];
        // Do not directly print output when using the TUI
        if ((0, is_tui_enabled_1.isTuiEnabled)()) {
            return;
        }
        this.printFlakyTasksMessage();
    }
    printFlakyTasksMessage() {
        if (this.flakyTasks?.length > 0) {
            const MAX_VISIBLE_FLAKY = 5;
            const visibleFlaky = this.flakyTasks.length > MAX_VISIBLE_FLAKY + 1
                ? this.flakyTasks.slice(0, MAX_VISIBLE_FLAKY)
                : this.flakyTasks;
            const hiddenCount = this.flakyTasks.length - visibleFlaky.length;
            const flakyRows = visibleFlaky.map((hash) => {
                const taskRun = this.taskRuns.get(hash);
                return `  ${(0, serialize_target_1.serializeTarget)(taskRun.target.project, taskRun.target.target, taskRun.target.configuration)}`;
            });
            if (hiddenCount > 0) {
                flakyRows.push(`  ${hiddenCount} more...`);
            }
            output_1.output.warn({
                title: `Nx detected ${this.flakyTasks.length === 1
                    ? 'a flaky task'
                    : `${this.flakyTasks.length} flaky tasks`}`,
                bodyLines: [
                    ,
                    ...flakyRows,
                    ...((0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)())
                        ? []
                        : [
                            '',
                            `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
                        ]),
                ],
            });
        }
    }
}
exports.TaskHistoryLifeCycle = TaskHistoryLifeCycle;
