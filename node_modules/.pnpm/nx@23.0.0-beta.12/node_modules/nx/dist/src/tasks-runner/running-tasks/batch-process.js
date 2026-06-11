"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchProcess = void 0;
const tslib_1 = require("tslib");
const tree_kill_1 = tslib_1.__importDefault(require("tree-kill"));
const exit_codes_1 = require("../../utils/exit-codes");
const batch_messages_1 = require("../batch/batch-messages");
class BatchProcess {
    constructor(childProcess, executorName) {
        this.childProcess = childProcess;
        this.executorName = executorName;
        this.exitCallbacks = [];
        this.batchResultsCallbacks = [];
        this.taskResultsCallbacks = [];
        this.outputCallbacks = [];
        this.childProcess.on('message', (message) => {
            switch (message.type) {
                case batch_messages_1.BatchMessageType.CompleteTask: {
                    for (const cb of this.taskResultsCallbacks) {
                        cb(message.task, message.result);
                    }
                    break;
                }
                case batch_messages_1.BatchMessageType.CompleteBatchExecution: {
                    for (const cb of this.batchResultsCallbacks) {
                        cb(message.results);
                    }
                    break;
                }
                case batch_messages_1.BatchMessageType.RunTasks: {
                    break;
                }
                default: {
                    // Re-emit any non-batch messages from the task process
                    if (process.send) {
                        process.send(message);
                    }
                }
            }
        });
        this.childProcess.once('exit', (code, signal) => {
            if (code === null)
                code = (0, exit_codes_1.signalToCode)(signal);
            for (const cb of this.exitCallbacks) {
                cb(code);
            }
        });
        // Capture stdout output
        if (this.childProcess.stdout) {
            this.childProcess.stdout.on('data', (chunk) => {
                const output = chunk.toString();
                // Maintain current terminal output behavior
                process.stdout.write(chunk);
                // Notify callbacks for TUI
                for (const cb of this.outputCallbacks) {
                    cb(output);
                }
            });
        }
        // Capture stderr output
        if (this.childProcess.stderr) {
            this.childProcess.stderr.on('data', (chunk) => {
                const output = chunk.toString();
                // Maintain current terminal output behavior
                process.stderr.write(chunk);
                // Notify callbacks for TUI
                for (const cb of this.outputCallbacks) {
                    cb(output);
                }
            });
        }
    }
    onExit(cb) {
        this.exitCallbacks.push(cb);
    }
    onBatchResults(cb) {
        this.batchResultsCallbacks.push(cb);
    }
    onTaskResults(cb) {
        this.taskResultsCallbacks.push(cb);
    }
    onOutput(cb) {
        this.outputCallbacks.push(cb);
    }
    async getResults() {
        return Promise.race([
            new Promise((_, rej) => {
                this.onExit((code) => {
                    if (code !== 0) {
                        rej(new Error(`"${this.executorName}" exited unexpectedly with code: ${code}`));
                    }
                });
            }),
            new Promise((res) => {
                this.onBatchResults(res);
            }),
        ]);
    }
    send(message) {
        if (this.childProcess.connected) {
            this.childProcess.send(message);
        }
    }
    kill(signal) {
        if (this.childProcess?.pid) {
            (0, tree_kill_1.default)(this.childProcess.pid, signal, () => {
                // Ignore errors - process may have already exited
            });
        }
    }
}
exports.BatchProcess = BatchProcess;
