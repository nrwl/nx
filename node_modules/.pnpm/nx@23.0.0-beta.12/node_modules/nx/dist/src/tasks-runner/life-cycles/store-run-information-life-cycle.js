"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreRunInformationLifeCycle = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const cache_directory_1 = require("../../utils/cache-directory");
class StoreRunInformationLifeCycle {
    constructor(command = parseCommand(), storeFile = storeFileFunction, now = () => new Date().toISOString()) {
        this.command = command;
        this.storeFile = storeFile;
        this.now = now;
        this.timings = {};
        this.taskResults = [];
    }
    startTasks(tasks) {
        for (let t of tasks) {
            this.timings[t.id] = {
                start: this.now(),
                end: undefined,
            };
        }
    }
    endTasks(taskResults) {
        for (let tr of taskResults) {
            if (tr.task.startTime) {
                this.timings[tr.task.id].start = new Date(tr.task.startTime).toISOString();
            }
            if (tr.task.endTime) {
                this.timings[tr.task.id].end = new Date(tr.task.endTime).toISOString();
            }
            else {
                this.timings[tr.task.id].end = this.now();
            }
        }
        this.taskResults.push(...taskResults);
    }
    startCommand() {
        this.startTime = this.now();
    }
    endCommand() {
        try {
            const endTime = this.now();
            const runDetails = {
                run: {
                    command: this.command,
                    startTime: this.startTime,
                    endTime: endTime,
                    inner: false,
                },
                tasks: this.taskResults.map((tr) => {
                    const cacheStatus = tr.status === 'remote-cache'
                        ? 'remote-cache-hit'
                        : tr.status === 'local-cache' ||
                            tr.status === 'local-cache-kept-existing'
                            ? 'local-cache-hit'
                            : 'cache-miss';
                    return {
                        taskId: tr.task.id,
                        target: tr.task.target.target,
                        projectName: tr.task.target.project,
                        hash: tr.task.hash,
                        startTime: this.timings[tr.task.id].start,
                        endTime: this.timings[tr.task.id].end,
                        params: '',
                        cacheStatus,
                        status: tr.code,
                    };
                }),
            };
            this.storeFile(runDetails);
        }
        catch (e) {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                console.error(e);
            }
        }
    }
}
exports.StoreRunInformationLifeCycle = StoreRunInformationLifeCycle;
function parseCommand() {
    const cmdBase = (0, path_1.parse)(process.argv[1]).name;
    const args = `${process.argv.slice(2).join(' ')}`;
    return `${cmdBase} ${args}`;
}
function storeFileFunction(runDetails) {
    (0, fs_1.writeFileSync)((0, path_1.join)(cache_directory_1.cacheDir, 'run.json'), JSON.stringify(runDetails, null, 2));
}
