"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeLifeCycle = void 0;
class CompositeLifeCycle {
    constructor(lifeCycles) {
        this.lifeCycles = lifeCycles;
    }
    async startCommand(parallel) {
        for (let l of this.lifeCycles) {
            if (l.startCommand) {
                await l.startCommand(parallel);
            }
        }
    }
    async endCommand() {
        for (let l of this.lifeCycles) {
            if (l.endCommand) {
                await l.endCommand();
            }
        }
    }
    async scheduleTask(task) {
        for (let l of this.lifeCycles) {
            if (l.scheduleTask) {
                await l.scheduleTask(task);
            }
        }
    }
    startTask(task) {
        for (let l of this.lifeCycles) {
            if (l.startTask) {
                l.startTask(task);
            }
        }
    }
    endTask(task, code) {
        for (let l of this.lifeCycles) {
            if (l.endTask) {
                l.endTask(task, code);
            }
        }
    }
    async startTasks(tasks, metadata) {
        for (let l of this.lifeCycles) {
            if (l.startTasks) {
                await l.startTasks(tasks, metadata);
            }
            else if (l.startTask) {
                tasks.forEach((t) => l.startTask(t));
            }
        }
    }
    async endTasks(taskResults, metadata) {
        for (let l of this.lifeCycles) {
            if (l.endTasks) {
                await l.endTasks(taskResults, metadata);
            }
            else if (l.endTask) {
                taskResults.forEach((t) => l.endTask(t.task, t.code));
            }
        }
    }
    printTaskTerminalOutput(task, status, output) {
        for (let l of this.lifeCycles) {
            if (l.printTaskTerminalOutput) {
                l.printTaskTerminalOutput(task, status, output);
            }
        }
    }
    registerRunningTask(taskId, parserAndWriter) {
        for (let l of this.lifeCycles) {
            if (l.registerRunningTask) {
                l.registerRunningTask(taskId, parserAndWriter);
            }
        }
    }
    registerRunningTaskWithEmptyParser(taskId) {
        for (let l of this.lifeCycles) {
            if (l.registerRunningTaskWithEmptyParser) {
                l.registerRunningTaskWithEmptyParser(taskId);
            }
        }
    }
    appendTaskOutput(taskId, output, isPtyTask) {
        for (let l of this.lifeCycles) {
            if (l.appendTaskOutput) {
                l.appendTaskOutput(taskId, output, isPtyTask);
            }
        }
    }
    setTaskStatus(taskId, status) {
        for (let l of this.lifeCycles) {
            if (l.setTaskStatus) {
                l.setTaskStatus(taskId, status);
            }
        }
    }
    setTaskTiming(taskId, startTime, endTime) {
        for (let l of this.lifeCycles) {
            if (l.setTaskTiming) {
                l.setTaskTiming(taskId, startTime, endTime);
            }
        }
    }
    registerForcedShutdownCallback(callback) {
        for (let l of this.lifeCycles) {
            if (l.registerForcedShutdownCallback) {
                l.registerForcedShutdownCallback(callback);
            }
        }
    }
    setEstimatedTaskTimings(timings) {
        for (let l of this.lifeCycles) {
            if (l.setEstimatedTaskTimings) {
                l.setEstimatedTaskTimings(timings);
            }
        }
    }
    registerRunningBatch(batchId, batchInfo) {
        for (let l of this.lifeCycles) {
            if (l.registerRunningBatch) {
                l.registerRunningBatch(batchId, batchInfo);
            }
        }
    }
    appendBatchOutput(batchId, output) {
        for (let l of this.lifeCycles) {
            if (l.appendBatchOutput) {
                l.appendBatchOutput(batchId, output);
            }
        }
    }
    setBatchStatus(batchId, status) {
        for (let l of this.lifeCycles) {
            if (l.setBatchStatus) {
                l.setBatchStatus(batchId, status);
            }
        }
    }
}
exports.CompositeLifeCycle = CompositeLifeCycle;
