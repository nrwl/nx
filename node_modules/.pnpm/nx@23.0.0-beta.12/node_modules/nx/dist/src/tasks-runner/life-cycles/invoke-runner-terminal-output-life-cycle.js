"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvokeRunnerTerminalOutputLifeCycle = void 0;
const output_1 = require("../../utils/output");
const utils_1 = require("../utils");
class InvokeRunnerTerminalOutputLifeCycle {
    constructor(tasks) {
        this.tasks = tasks;
        this.failedTasks = [];
        this.cachedTasks = [];
    }
    startCommand() {
        output_1.output.log({
            color: 'cyan',
            title: `Running ${this.tasks.length} tasks:`,
            bodyLines: this.tasks.map((task) => {
                const unparsed = (0, utils_1.getUnparsedOverrideArgs)(task);
                return `- Task ${task.id} ${unparsed.length > 0 ? `Overrides: ${unparsed.join(' ')}` : ''}`;
            }),
        });
        output_1.output.addVerticalSeparatorWithoutNewLines('cyan');
    }
    endCommand() {
        output_1.output.addNewline();
        const taskIds = this.tasks.map((task) => {
            const cached = this.cachedTasks.indexOf(task) !== -1;
            const failed = this.failedTasks.indexOf(task) !== -1;
            const unparsed = (0, utils_1.getUnparsedOverrideArgs)(task);
            return `- Task ${task.id} ${unparsed.length > 0 ? `Overrides: ${unparsed.join(' ')}` : ''} ${cached ? 'CACHED' : ''} ${failed ? 'FAILED' : ''}`;
        });
        if (this.failedTasks.length === 0) {
            output_1.output.addVerticalSeparatorWithoutNewLines('green');
            output_1.output.success({
                title: `Successfully ran ${this.tasks.length} tasks:`,
                bodyLines: taskIds,
            });
        }
        else {
            output_1.output.addVerticalSeparatorWithoutNewLines('red');
            output_1.output.error({
                title: `Ran ${this.tasks.length} tasks:`,
                bodyLines: taskIds,
            });
        }
    }
    endTasks(taskResults) {
        for (let t of taskResults) {
            if (t.status === 'failure') {
                this.failedTasks.push(t.task);
            }
            else if (t.status === 'local-cache') {
                this.cachedTasks.push(t.task);
            }
            else if (t.status === 'local-cache-kept-existing') {
                this.cachedTasks.push(t.task);
            }
            else if (t.status === 'remote-cache') {
                this.cachedTasks.push(t.task);
            }
        }
    }
    printTaskTerminalOutput(task, cacheStatus, terminalOutput) {
        const args = (0, utils_1.getPrintableCommandArgsForTask)(task);
        output_1.output.logCommandOutput(args.join(' '), cacheStatus, terminalOutput);
    }
}
exports.InvokeRunnerTerminalOutputLifeCycle = InvokeRunnerTerminalOutputLifeCycle;
