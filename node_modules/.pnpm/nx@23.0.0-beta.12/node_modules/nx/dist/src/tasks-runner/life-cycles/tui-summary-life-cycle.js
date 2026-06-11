"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTuiTerminalSummaryLifeCycle = getTuiTerminalSummaryLifeCycle;
const tslib_1 = require("tslib");
const node_os_1 = require("node:os");
const output_1 = require("../../utils/output");
const formatting_utils_1 = require("./formatting-utils");
const pretty_time_1 = require("./pretty-time");
const task_graph_utils_1 = require("../task-graph-utils");
const view_logs_utils_1 = require("./view-logs-utils");
const figures = tslib_1.__importStar(require("figures"));
const pc = tslib_1.__importStar(require("picocolors"));
const task_history_life_cycle_1 = require("./task-history-life-cycle");
const LEFT_PAD = `   `;
const SPACER = `  `;
const EXTENDED_LEFT_PAD = `      `;
function getTuiTerminalSummaryLifeCycle({ projectNames, tasks, taskGraph, args, overrides, initiatingProject, initiatingTasks, resolveRenderIsDonePromise, }) {
    const lifeCycle = {};
    const start = process.hrtime();
    const targets = args.targets;
    const totalTasks = tasks.length;
    let totalCachedTasks = 0;
    let totalSuccessfulTasks = 0;
    let totalFailedTasks = 0;
    let totalCompletedTasks = 0;
    let timeTakenText;
    const failedTasks = new Set();
    const inProgressTasks = new Set();
    // Tasks ended with 'stopped' status (interrupted, didn't finish — counts as failure)
    const stoppedTasks = new Set();
    // Tasks shown with cyan stopped icon (includes fulfilled continuous tasks ended as 'success')
    const displayStoppedTasks = new Set();
    // Chunks accumulated progressively during task execution
    const taskOutputChunks = {};
    // Finalized output strings set on task completion — read by summary print functions
    const tasksToTerminalOutputs = {};
    const tasksToTaskStatus = {};
    const taskIdsInTheOrderTheyStart = [];
    const getTerminalOutput = (taskId) => tasksToTerminalOutputs[taskId] ?? taskOutputChunks[taskId]?.join('') ?? '';
    lifeCycle.startTasks = (tasks) => {
        for (let t of tasks) {
            taskOutputChunks[t.id] ??= [];
            taskIdsInTheOrderTheyStart.push(t.id);
            inProgressTasks.add(t.id);
        }
    };
    lifeCycle.appendTaskOutput = (taskId, output) => {
        // Task already completed and output was finalized by endTasks — discard late-arriving data
        if (!taskOutputChunks[taskId]) {
            return;
        }
        taskOutputChunks[taskId].push(output);
    };
    // TODO(@AgentEnder): The following 2 methods should be one but will need more refactoring
    lifeCycle.printTaskTerminalOutput = (task, taskStatus, output) => {
        tasksToTaskStatus[task.id] = taskStatus;
        // Store the complete output for display in the summary
        // This is called with the full output for cached tasks. For non-cached tasks,
        // the output doesn't include the portion of the output that prints the command that was being ran.
        if (output &&
            !['failure', 'success'].includes(taskStatus)) {
            tasksToTerminalOutputs[task.id] = output;
        }
    };
    lifeCycle.setTaskStatus = (taskId, taskStatus) => {
        if (taskStatus === 9 /* NativeTaskStatus.Stopped */) {
            displayStoppedTasks.add(taskId);
            inProgressTasks.delete(taskId);
        }
        else if (taskStatus === 2 /* NativeTaskStatus.Skipped */) {
            // Skipped tasks don't get an endTasks() call; clear them here so the run
            // summary doesn't treat them as still-in-progress and report Cancelled.
            tasksToTaskStatus[taskId] = 'skipped';
            inProgressTasks.delete(taskId);
        }
    };
    lifeCycle.endTasks = (taskResults) => {
        for (const { task, status, terminalOutput } of taskResults) {
            totalCompletedTasks++;
            inProgressTasks.delete(task.id);
            tasksToTaskStatus[task.id] = status;
            if (status === 'stopped') {
                stoppedTasks.add(task.id);
            }
            switch (status) {
                case 'remote-cache':
                case 'local-cache':
                case 'local-cache-kept-existing':
                    totalCachedTasks++;
                    totalSuccessfulTasks++;
                    break;
                case 'success':
                    totalSuccessfulTasks++;
                    break;
                case 'failure':
                    totalFailedTasks++;
                    failedTasks.add(task.id);
                    break;
                case 'stopped':
                    break;
            }
            // Store the final string directly — shares the same reference as
            // TaskResultsLifeCycle, old chunks become GC-eligible
            if (terminalOutput !== undefined) {
                tasksToTerminalOutputs[task.id] = terminalOutput;
                delete taskOutputChunks[task.id];
            }
        }
    };
    lifeCycle.endCommand = () => {
        timeTakenText = (0, pretty_time_1.prettyTime)(process.hrtime(start));
        resolveRenderIsDonePromise();
    };
    const printSummary = () => {
        const isRunOne = initiatingProject && targets?.length === 1;
        // Handles when the user interrupts the process
        timeTakenText ??= (0, pretty_time_1.prettyTime)(process.hrtime(start));
        if (totalTasks === 0) {
            console.log(`\n${output_1.output.applyNxPrefix('gray', 'No tasks were run')}\n`);
            return;
        }
        const failure = totalSuccessfulTasks !== totalTasks;
        const cancelled = stoppedTasks.size > 0 ||
            inProgressTasks.size > 0 ||
            [...(0, task_graph_utils_1.getLeafTasks)(taskGraph)].some((t) => taskGraph.tasks[t]?.continuous);
        if (isRunOne) {
            printRunOneSummary({
                failure,
                cancelled,
            });
        }
        else {
            printRunManySummary({
                failure,
                cancelled,
            });
        }
        (0, task_history_life_cycle_1.getTasksHistoryLifeCycle)().printFlakyTasksMessage();
    };
    const printRunOneSummary = ({ failure, cancelled, }) => {
        // Print task outputs in completion order above the summary.
        for (const taskId of taskIdsInTheOrderTheyStart) {
            const taskStatus = tasksToTaskStatus[taskId];
            // Skipped tasks never ran; don't print a misleading `> nx run` header.
            if (taskStatus === 'skipped') {
                continue;
            }
            const terminalOutput = getTerminalOutput(taskId);
            output_1.output.logCommandOutput(taskId, taskStatus, terminalOutput);
        }
        // Print vertical separator
        const separatorLines = output_1.output.getVerticalSeparatorLines(failure ? 'red' : 'green');
        for (const line of separatorLines) {
            console.log(line);
        }
        if (!failure && !cancelled) {
            const text = `Successfully ran ${(0, formatting_utils_1.formatTargetsAndProjects)([initiatingProject], targets, tasks)}`;
            // Build success message with color applied to the entire block
            const messageLines = [
                output_1.output.applyNxPrefix('green', output_1.output.colors.green(text) + output_1.output.dim(` (${timeTakenText})`)),
            ];
            const filteredOverrides = Object.entries(overrides).filter(
            // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
            ([flag]) => flag !== 'nxReleaseVersionData');
            if (filteredOverrides.length > 0) {
                messageLines.push('');
                messageLines.push(`${EXTENDED_LEFT_PAD}${pc.dim(pc.green('With additional flags:'))}`);
                filteredOverrides
                    .map(([flag, value]) => pc.dim(pc.green((0, formatting_utils_1.formatFlags)(EXTENDED_LEFT_PAD, flag, value))))
                    .forEach((arg) => messageLines.push(arg));
            }
            if (totalCachedTasks > 0) {
                messageLines.push(output_1.output.dim(`${node_os_1.EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`));
            }
            // Print the entire success message block with green color
            console.log(output_1.output.colors.green(messageLines.join(node_os_1.EOL)));
        }
        else if (!cancelled) {
            let text = `Ran target ${output_1.output.bold(targets[0])} for project ${output_1.output.bold(initiatingProject)}`;
            if (tasks.length > 1) {
                text += ` and ${output_1.output.bold(tasks.length - 1)} task(s) they depend on`;
            }
            // Build failure message lines
            const messageLines = [
                output_1.output.applyNxPrefix('red', output_1.output.colors.red(text) + output_1.output.dim(` (${timeTakenText})`)),
            ];
            const filteredOverrides = Object.entries(overrides).filter(
            // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
            ([flag]) => flag !== 'nxReleaseVersionData');
            if (filteredOverrides.length > 0) {
                messageLines.push('');
                messageLines.push(`${EXTENDED_LEFT_PAD}${pc.dim(pc.red('With additional flags:'))}`);
                filteredOverrides
                    .map(([flag, value]) => pc.dim(pc.red((0, formatting_utils_1.formatFlags)(EXTENDED_LEFT_PAD, flag, value))))
                    .forEach((arg) => messageLines.push(arg));
            }
            messageLines.push('');
            messageLines.push(`${LEFT_PAD}${output_1.output.colors.red(figures.cross)}${SPACER}${totalFailedTasks}${`/${totalCompletedTasks}`} failed`);
            messageLines.push(`${LEFT_PAD}${output_1.output.dim(figures.tick)}${SPACER}${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output_1.output.dim(`[${totalCachedTasks} read from cache]`)}`);
            const viewLogs = (0, view_logs_utils_1.viewLogsFooterRows)(totalFailedTasks);
            messageLines.push(...viewLogs);
            // Print the entire failure message block with red color
            console.log(output_1.output.colors.red(messageLines.join(node_os_1.EOL)));
        }
        else {
            console.log(output_1.output.applyNxPrefix('red', output_1.output.colors.red(`Cancelled running target ${output_1.output.bold(targets[0])} for project ${output_1.output.bold(initiatingProject)}`) + output_1.output.dim(` (${timeTakenText})`)));
        }
        // adds some vertical space after the summary to avoid bunching against terminal
        console.log('');
    };
    const printRunManySummary = ({ failure, cancelled, }) => {
        console.log('');
        // Collect checklist lines to print after task outputs
        const checklistLines = [];
        // Sort tasks by status: successful tasks first, failed tasks at the end
        const sortedTaskIds = [...taskIdsInTheOrderTheyStart].sort((a, b) => {
            const statusA = tasksToTaskStatus[a];
            const statusB = tasksToTaskStatus[b];
            const isFailureA = statusA === 'failure' || !statusA ? 1 : 0;
            const isFailureB = statusB === 'failure' || !statusB ? 1 : 0;
            return isFailureA - isFailureB;
        });
        // First pass: Print task outputs and collect checklist lines
        for (const taskId of sortedTaskIds) {
            const taskStatus = tasksToTaskStatus[taskId];
            const terminalOutput = getTerminalOutput(taskId);
            if (displayStoppedTasks.has(taskId) || !taskStatus) {
                output_1.output.logCommandOutput(taskId, taskStatus, terminalOutput);
                output_1.output.addNewline();
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.cyan(figures.squareSmallFilled)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}`);
            }
            else if (taskStatus === 'failure') {
                output_1.output.logCommandOutput(taskId, taskStatus, terminalOutput);
                output_1.output.addNewline();
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.red(figures.cross)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}`);
            }
            else if (taskStatus === 'local-cache') {
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.green(figures.tick)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}  ${output_1.output.dim('[local cache]')}`);
            }
            else if (taskStatus === 'local-cache-kept-existing') {
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.green(figures.tick)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}  ${output_1.output.dim('[existing outputs match the cache, left as is]')}`);
            }
            else if (taskStatus === 'remote-cache') {
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.green(figures.tick)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}  ${output_1.output.dim('[remote cache]')}`);
            }
            else if (taskStatus === 'success') {
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.green(figures.tick)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}`);
            }
            else {
                checklistLines.push(`${LEFT_PAD}${output_1.output.colors.green(figures.tick)}${SPACER}${output_1.output.colors.gray('nx run ')}${taskId}`);
            }
        }
        // Print all checklist lines together
        console.log();
        for (const line of checklistLines) {
            console.log(line);
        }
        // Print vertical separator
        const separatorLines = output_1.output.getVerticalSeparatorLines(failure ? 'red' : 'green');
        for (const line of separatorLines) {
            console.log(line);
        }
        if (totalSuccessfulTasks === totalTasks) {
            const text = `Successfully ran ${(0, formatting_utils_1.formatTargetsAndProjects)(projectNames, targets, tasks)}`;
            const successSummaryRows = [
                output_1.output.applyNxPrefix('green', output_1.output.colors.green(text) + pc.dim(pc.white(` (${timeTakenText})`))),
            ];
            const filteredOverrides = Object.entries(overrides).filter(
            // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
            ([flag]) => flag !== 'nxReleaseVersionData');
            if (filteredOverrides.length > 0) {
                successSummaryRows.push('');
                successSummaryRows.push(`${EXTENDED_LEFT_PAD}${pc.dim(pc.green('With additional flags:'))}`);
                filteredOverrides
                    .map(([flag, value]) => pc.dim(pc.green((0, formatting_utils_1.formatFlags)(EXTENDED_LEFT_PAD, flag, value))))
                    .forEach((arg) => successSummaryRows.push(arg));
            }
            if (totalCachedTasks > 0) {
                successSummaryRows.push(output_1.output.dim(`${node_os_1.EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`));
            }
            console.log(successSummaryRows.join(node_os_1.EOL));
        }
        else {
            const text = `${cancelled ? 'Cancelled while running' : 'Ran'} ${(0, formatting_utils_1.formatTargetsAndProjects)(projectNames, targets, tasks)}`;
            const failureSummaryRows = [
                output_1.output.applyNxPrefix('red', output_1.output.colors.red(text) + pc.dim(pc.white(` (${timeTakenText})`))),
            ];
            const filteredOverrides = Object.entries(overrides).filter(
            // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
            ([flag]) => flag !== 'nxReleaseVersionData');
            if (filteredOverrides.length > 0) {
                failureSummaryRows.push('');
                failureSummaryRows.push(`${EXTENDED_LEFT_PAD}${pc.dim(pc.red('With additional flags:'))}`);
                filteredOverrides
                    .map(([flag, value]) => pc.dim(pc.red((0, formatting_utils_1.formatFlags)(EXTENDED_LEFT_PAD, flag, value))))
                    .forEach((arg) => failureSummaryRows.push(arg));
            }
            failureSummaryRows.push('');
            if (totalCompletedTasks > 0) {
                // For display purposes, treat stopped tasks as in-progress
                // (they were running when the process was interrupted)
                const displayCompleted = totalCompletedTasks - stoppedTasks.size;
                const displayInProgress = new Set([
                    ...inProgressTasks,
                    ...stoppedTasks,
                ]);
                if (totalSuccessfulTasks > 0) {
                    failureSummaryRows.push(output_1.output.dim(`${LEFT_PAD}${output_1.output.dim(figures.tick)}${SPACER}${totalSuccessfulTasks}${`/${displayCompleted}`} succeeded ${output_1.output.dim(`[${totalCachedTasks} read from cache]`)}`), '');
                }
                if (totalFailedTasks > 0) {
                    const numFailedToPrint = 5;
                    const failedTasksForPrinting = Array.from(failedTasks).slice(0, numFailedToPrint);
                    failureSummaryRows.push(`${LEFT_PAD}${output_1.output.colors.red(figures.cross)}${SPACER}${totalFailedTasks}${`/${displayCompleted}`} targets failed, including the following:`, '', `${failedTasksForPrinting
                        .map((t) => `${EXTENDED_LEFT_PAD}${output_1.output.colors.red('-')} ${output_1.output.formatCommand(t.toString())}`)
                        .join('\n')}`, '');
                    if (failedTasks.size > numFailedToPrint) {
                        failureSummaryRows.push(output_1.output.dim(`${EXTENDED_LEFT_PAD}...and ${failedTasks.size - numFailedToPrint} more...`));
                    }
                }
                if (displayCompleted !== totalTasks) {
                    const remainingTasks = totalTasks - displayCompleted;
                    if (displayInProgress.size) {
                        failureSummaryRows.push(`${LEFT_PAD}${output_1.output.colors.red(figures.ellipsis)}${SPACER}${displayInProgress.size}${`/${totalTasks}`} targets were in progress, including the following:`, '', `${Array.from(displayInProgress)
                            .map((t) => `${EXTENDED_LEFT_PAD}${output_1.output.colors.red('-')} ${output_1.output.formatCommand(t.toString())}`)
                            .join(node_os_1.EOL)}`, '');
                    }
                    if (remainingTasks - displayInProgress.size > 0) {
                        failureSummaryRows.push(output_1.output.dim(`${LEFT_PAD}${output_1.output.colors.red(figures.ellipsis)}${SPACER}${remainingTasks - displayInProgress.size}${`/${totalTasks}`} targets had not started.`), '');
                    }
                }
                failureSummaryRows.push(...(0, view_logs_utils_1.viewLogsFooterRows)(failedTasks.size));
            }
            console.log(output_1.output.colors.red(failureSummaryRows.join(node_os_1.EOL)));
        }
        // adds some vertical space after the summary to avoid bunching against terminal
        console.log('');
    };
    return { lifeCycle: lifeCycle, printSummary };
}
