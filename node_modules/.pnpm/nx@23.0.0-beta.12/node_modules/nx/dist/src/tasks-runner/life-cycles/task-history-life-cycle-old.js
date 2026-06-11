"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyTaskHistoryLifeCycle = void 0;
const nx_json_1 = require("../../config/nx-json");
const legacy_task_history_1 = require("../../utils/legacy-task-history");
const nx_cloud_utils_1 = require("../../utils/nx-cloud-utils");
const output_1 = require("../../utils/output");
const serialize_target_1 = require("../../utils/serialize-target");
const is_tui_enabled_1 = require("../is-tui-enabled");
class LegacyTaskHistoryLifeCycle {
    constructor() {
        this.startTimings = {};
        this.pendingResults = [];
    }
    startTasks(tasks) {
        for (let task of tasks) {
            this.startTimings[task.id] = new Date().getTime();
        }
    }
    async endTasks(taskResults) {
        for (const taskResult of taskResults) {
            this.pendingResults.push(taskResult);
        }
    }
    async endCommand() {
        // Build TaskRun objects now — task.hash is guaranteed to be set by this point
        const taskRuns = [];
        const cacheableHashes = new Set();
        for (const taskResult of this.pendingResults) {
            if (taskResult.task.cache === true) {
                cacheableHashes.add(taskResult.task.hash);
            }
            taskRuns.push({
                project: taskResult.task.target.project,
                target: taskResult.task.target.target,
                configuration: taskResult.task.target.configuration,
                hash: taskResult.task.hash,
                code: taskResult.code.toString(),
                status: taskResult.status,
                start: (taskResult.task.startTime ?? this.startTimings[taskResult.task.id]).toString(),
                end: (taskResult.task.endTime ?? new Date().getTime()).toString(),
            });
        }
        await (0, legacy_task_history_1.writeTaskRunsToHistory)(taskRuns);
        // Only check for flaky tasks among cacheable tasks
        const cacheableTaskRuns = taskRuns.filter((t) => cacheableHashes.has(t.hash));
        const history = await (0, legacy_task_history_1.getHistoryForHashes)(cacheableTaskRuns.map((t) => t.hash));
        this.flakyTasks = [];
        // check if any hash has different exit codes => flaky
        for (let hash in history) {
            if (history[hash].length > 1 &&
                history[hash].some((run) => run.code !== history[hash][0].code)) {
                this.flakyTasks.push((0, serialize_target_1.serializeTarget)(history[hash][0].project, history[hash][0].target, history[hash][0].configuration));
            }
        }
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
            const flakyRows = visibleFlaky.map((t) => `  ${t}`);
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
exports.LegacyTaskHistoryLifeCycle = LegacyTaskHistoryLifeCycle;
