"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskTelemetryLifeCycle = void 0;
const perf_hooks_1 = require("perf_hooks");
const analytics_1 = require("../../analytics");
class TaskTelemetryLifeCycle {
    constructor() {
        this.taskCount = 0;
        this.cachedTaskCount = 0;
        this.projects = new Set();
    }
    startCommand() {
        perf_hooks_1.performance.mark('task-execution-lifecycle:start');
    }
    endTasks(taskResults, metadata) {
        for (const r of taskResults) {
            this.taskCount++;
            this.projects.add(r.task.target.project);
            if (r.status === 'local-cache' ||
                r.status === 'local-cache-kept-existing' ||
                r.status === 'remote-cache') {
                this.cachedTaskCount++;
            }
        }
    }
    endCommand() {
        perf_hooks_1.performance.mark('task-execution-lifecycle:end');
        perf_hooks_1.performance.measure('task-execution', {
            start: 'task-execution-lifecycle:start',
            end: 'task-execution-lifecycle:end',
            detail: {
                track: true,
                ...(analytics_1.customDimensions && {
                    [analytics_1.customDimensions.taskCount]: this.taskCount,
                    [analytics_1.customDimensions.cachedTaskCount]: this.cachedTaskCount,
                    [analytics_1.customDimensions.projectCount]: this.projects.size,
                }),
            },
        });
    }
}
exports.TaskTelemetryLifeCycle = TaskTelemetryLifeCycle;
