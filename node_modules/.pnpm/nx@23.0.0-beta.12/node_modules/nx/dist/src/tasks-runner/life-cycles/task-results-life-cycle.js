"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskResultsLifeCycle = void 0;
class TaskResultsLifeCycle {
    constructor() {
        this.taskResults = {};
    }
    endTasks(taskResults) {
        for (let t of taskResults) {
            this.taskResults[t.task.id] = t;
        }
    }
    getTaskResults() {
        return this.taskResults;
    }
}
exports.TaskResultsLifeCycle = TaskResultsLifeCycle;
