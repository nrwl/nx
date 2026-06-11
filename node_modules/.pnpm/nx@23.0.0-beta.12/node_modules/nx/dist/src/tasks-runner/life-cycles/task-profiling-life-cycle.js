"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskProfilingLifeCycle = void 0;
const path_1 = require("path");
const fileutils_1 = require("../../utils/fileutils");
class TaskProfilingLifeCycle {
    constructor(_profileFile) {
        this.timings = {};
        this.profile = [];
        this.registeredGroups = new Set();
        this.profileFile = (0, path_1.join)(process.cwd(), _profileFile);
    }
    startTasks(tasks, { groupId }) {
        if (this.profileFile && !this.registeredGroups.has(groupId)) {
            this.registerGroup(groupId);
        }
        for (let t of tasks) {
            this.timings[t.id] = {
                perfStart: Date.now(),
            };
        }
    }
    endTasks(taskResults, metadata) {
        for (let tr of taskResults) {
            if (tr.task.startTime) {
                this.timings[tr.task.id].perfStart = tr.task.startTime;
            }
            if (tr.task.endTime) {
                this.timings[tr.task.id].perfEnd = tr.task.endTime;
            }
            else {
                this.timings[tr.task.id].perfEnd = Date.now();
            }
        }
        this.recordTaskCompletions(taskResults, metadata);
    }
    endCommand() {
        (0, fileutils_1.writeJsonFile)(this.profileFile, this.profile);
        console.log(`Performance Profile: ${this.profileFile}`);
    }
    recordTaskCompletions(tasks, { groupId }) {
        for (const { task, status } of tasks) {
            const { perfStart, perfEnd } = this.timings[task.id];
            this.profile.push({
                name: task.id,
                cat: Object.values(task.target).join(','),
                ph: 'X',
                ts: perfStart * 1000,
                dur: (perfEnd - perfStart) * 1000,
                pid: process.pid,
                tid: groupId,
                args: {
                    target: task.target,
                    status,
                },
            });
        }
    }
    registerGroup(groupId) {
        this.profile.push({
            name: 'thread_name',
            ph: 'M',
            pid: process.pid,
            tid: groupId,
            ts: 0,
            args: {
                name: 'Group #' + (groupId + 1),
            },
        });
        this.registeredGroups.add(groupId);
    }
}
exports.TaskProfilingLifeCycle = TaskProfilingLifeCycle;
