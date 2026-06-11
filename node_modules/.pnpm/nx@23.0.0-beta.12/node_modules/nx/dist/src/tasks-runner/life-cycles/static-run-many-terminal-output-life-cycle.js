"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticRunManyTerminalOutputLifeCycle = void 0;
const output_1 = require("../../utils/output");
const utils_1 = require("../utils");
const formatting_utils_1 = require("./formatting-utils");
/**
 * The following life cycle's outputs are static, meaning no previous content
 * is rewritten or modified as new outputs are added. It is therefore intended
 * for use in CI environments.
 *
 * For the common case of a user executing a command on their local machine,
 * the dynamic equivalent of this life cycle is usually preferable.
 */
class StaticRunManyTerminalOutputLifeCycle {
    constructor(projectNames, tasks, args, taskOverrides) {
        this.projectNames = projectNames;
        this.tasks = tasks;
        this.args = args;
        this.taskOverrides = taskOverrides;
        this.failedTasks = [];
        this.cachedTasks = [];
        this.allCompletedTasks = new Map();
    }
    startCommand() {
        if (this.tasks.length === 0) {
            return;
        }
        if (this.projectNames.length <= 0) {
            output_1.output.logSingleLine(`No projects with ${(0, formatting_utils_1.formatTargetsAndProjects)(this.projectNames, this.args.targets, this.tasks)} were run`);
            return;
        }
        const bodyLines = this.projectNames.map((affectedProject) => `${output_1.output.dim('-')} ${affectedProject}`);
        const filteredOverrides = Object.entries(this.taskOverrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData');
        if (filteredOverrides.length > 0) {
            bodyLines.push('');
            bodyLines.push(`${output_1.output.dim('With additional flags:')}`);
            filteredOverrides
                .map(([flag, value]) => (0, formatting_utils_1.formatFlags)('', flag, value))
                .forEach((arg) => bodyLines.push(arg));
        }
        const title = `Running ${(0, formatting_utils_1.formatTargetsAndProjects)(this.projectNames, this.args.targets, this.tasks)}:`;
        output_1.output.log({
            color: 'cyan',
            title,
            bodyLines,
        });
        output_1.output.addVerticalSeparatorWithoutNewLines('cyan');
    }
    endCommand() {
        output_1.output.addNewline();
        if (this.tasks.length === 0) {
            output_1.output.logSingleLine(`No tasks were run`);
            return;
        }
        if (this.failedTasks.length === 0) {
            output_1.output.addVerticalSeparatorWithoutNewLines('green');
            const bodyLines = this.cachedTasks.length > 0
                ? [
                    output_1.output.dim(`Nx read the output from the cache instead of running the command for ${this.cachedTasks.length} out of ${this.tasks.length} tasks.`),
                ]
                : [];
            output_1.output.success({
                title: `Successfully ran ${(0, formatting_utils_1.formatTargetsAndProjects)(this.projectNames, this.args.targets, this.tasks)}`,
                bodyLines,
            });
        }
        else {
            output_1.output.addVerticalSeparatorWithoutNewLines('red');
            const bodyLines = [];
            const skippedTasks = this.skippedTasks();
            if (skippedTasks.length > 0) {
                bodyLines.push(output_1.output.dim('Tasks not run because their dependencies failed or --nx-bail=true:'), '', ...skippedTasks.map((task) => `${output_1.output.dim('-')} ${task.id}`), '');
            }
            bodyLines.push(output_1.output.dim('Failed tasks:'), '', ...[...this.failedTasks.values()].map((task) => `${output_1.output.dim('-')} ${task.id}`));
            output_1.output.error({
                title: `Running ${(0, formatting_utils_1.formatTargetsAndProjects)(this.projectNames, this.args.targets, this.tasks)} failed`,
                bodyLines,
            });
        }
    }
    skippedTasks() {
        return this.tasks.filter((t) => !this.allCompletedTasks.has(t.id));
    }
    endTasks(taskResults) {
        for (let t of taskResults) {
            this.allCompletedTasks.set(t.task.id, t.task);
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
exports.StaticRunManyTerminalOutputLifeCycle = StaticRunManyTerminalOutputLifeCycle;
