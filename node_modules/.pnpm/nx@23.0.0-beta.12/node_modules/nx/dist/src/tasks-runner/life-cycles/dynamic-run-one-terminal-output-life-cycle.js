"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRunOneDynamicOutputRenderer = createRunOneDynamicOutputRenderer;
const tslib_1 = require("tslib");
const cliCursor = tslib_1.__importStar(require("cli-cursor"));
const cli_spinners_1 = require("cli-spinners");
const os_1 = require("os");
const readline = tslib_1.__importStar(require("readline"));
const output_1 = require("../../utils/output");
const pretty_time_1 = require("./pretty-time");
const formatting_utils_1 = require("./formatting-utils");
const view_logs_utils_1 = require("./view-logs-utils");
const handle_import_1 = require("../../utils/handle-import");
const pc = tslib_1.__importStar(require("picocolors"));
const LEFT_PAD = `   `;
const SPACER = `  `;
const EXTENDED_LEFT_PAD = `      `;
/**
 * The following function is responsible for creating a life cycle with dynamic
 * outputs, meaning previous outputs can be rewritten or modified as new outputs
 * are added. It is therefore intended for use on a user's local machines.
 *
 * In CI environments the static equivalent of this life cycle should be used.
 *
 * NOTE: output.dim() should be preferred over output.colors.gray() because it
 * is much more consistently readable across different terminal color themes.
 */
async function createRunOneDynamicOutputRenderer({ initiatingProject, tasks, args, overrides, }) {
    cliCursor.hide();
    // Show the cursor again after the process exits
    process.on('exit', () => {
        cliCursor.show();
    });
    let resolveRenderIsDonePromise;
    const renderIsDone = new Promise((resolve) => (resolveRenderIsDonePromise = resolve)).then(() => {
        clearRenderInterval();
        cliCursor.show();
    });
    function clearRenderInterval() {
        if (renderDependentTargetsIntervalId) {
            clearInterval(renderDependentTargetsIntervalId);
        }
    }
    process.on('exit', () => clearRenderInterval());
    process.on('SIGINT', () => clearRenderInterval());
    process.on('SIGTERM', () => clearRenderInterval());
    process.on('SIGHUP', () => clearRenderInterval());
    const lifeCycle = {};
    const start = process.hrtime();
    const figures = await (0, handle_import_1.handleImport)('figures');
    let state = 'EXECUTING_DEPENDENT_TARGETS';
    const tasksToTerminalOutputs = {};
    const totalTasks = tasks.length;
    const totalDependentTasks = totalTasks - 1;
    const totalTasksFromInitiatingProject = tasks.filter((t) => t.target.project === initiatingProject).length;
    // Tasks from the initiating project are treated differently, they forward their output
    const totalDependentTasksNotFromInitiatingProject = totalTasks - totalTasksFromInitiatingProject;
    const targetName = tasks[0].target.target;
    let dependentTargetsNumLines = 0;
    let totalCompletedTasks = 0;
    let totalSuccessfulTasks = 0;
    let totalFailedTasks = 0;
    let totalCachedTasks = 0;
    // Used to control the rendering of the spinner
    let dependentTargetsCurrentFrame = 0;
    let renderDependentTargetsIntervalId;
    const moveCursorToStartOfDependentTargetLines = () => {
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, 0, -dependentTargetsNumLines);
    };
    const renderLines = (lines, dividerColor = 'cyan', renderDivider = true) => {
        let additionalLines = 0;
        if (renderDivider) {
            const dividerLines = output_1.output.getVerticalSeparatorLines(dividerColor);
            for (const line of dividerLines) {
                output_1.output.overwriteLine(line);
            }
            additionalLines += dividerLines.length;
            lines.push('');
        }
        for (const line of lines) {
            output_1.output.overwriteLine(line);
        }
        dependentTargetsNumLines = lines.length + additionalLines;
        // clear any possible text below the cursor's position
        readline.clearScreenDown(process.stdout);
    };
    const renderDependentTargets = (renderDivider = true) => {
        if (totalDependentTasksNotFromInitiatingProject <= 0) {
            return;
        }
        const max = cli_spinners_1.dots.frames.length - 1;
        const curr = dependentTargetsCurrentFrame;
        dependentTargetsCurrentFrame = curr >= max ? 0 : curr + 1;
        const linesToRender = [''];
        const remainingDependentTasksNotFromInitiatingProject = totalDependentTasksNotFromInitiatingProject - totalCompletedTasks;
        switch (state) {
            case 'EXECUTING_DEPENDENT_TARGETS':
                if (totalFailedTasks === 0) {
                    linesToRender.push(`${LEFT_PAD}${output_1.output.colors.cyan(cli_spinners_1.dots.frames[dependentTargetsCurrentFrame])}${SPACER}${output_1.output.dim(`Nx is waiting on ${remainingDependentTasksNotFromInitiatingProject} dependent project tasks before running tasks from`)} ${initiatingProject}${output_1.output.dim('...')}`);
                    if (totalSuccessfulTasks > 0) {
                        linesToRender.push('');
                    }
                }
                break;
        }
        if (totalFailedTasks > 0) {
            linesToRender.push(pc.dim(pc.red(`${LEFT_PAD}${output_1.output.colors.red(figures.cross)}${SPACER}${totalFailedTasks}${`/${totalCompletedTasks}`} dependent project tasks failed (see below)`)));
        }
        if (totalSuccessfulTasks > 0) {
            linesToRender.push(output_1.output.dim(`${LEFT_PAD}${output_1.output.dim(figures.tick)}${SPACER}${totalSuccessfulTasks}${`/${totalCompletedTasks}`} dependent project tasks succeeded ${output_1.output.dim(`[${totalCachedTasks} read from cache]`)}`));
        }
        moveCursorToStartOfDependentTargetLines();
        if (linesToRender.length > 1) {
            renderLines(linesToRender, 'gray', renderDivider && state !== 'EXECUTING_DEPENDENT_TARGETS');
        }
        else {
            renderLines([]);
        }
    };
    lifeCycle.startCommand = () => {
        renderDependentTargets();
    };
    lifeCycle.startTasks = (tasks) => {
        for (const task of tasks) {
            // Move from the dependent project tasks phase to the initiating project's targets
            if (task.target.project === initiatingProject &&
                state !== 'EXECUTING_INITIATING_PROJECT_TARGET') {
                state = 'EXECUTING_INITIATING_PROJECT_TARGET';
                clearRenderInterval();
                renderDependentTargets(false);
                if (totalDependentTasksNotFromInitiatingProject > 0) {
                    output_1.output.addNewline();
                    process.stdout.write(`${LEFT_PAD}${output_1.output.dim('Hint: you can run the command with')} --verbose ${output_1.output.dim('to see the full dependent project outputs')}` + os_1.EOL);
                    output_1.output.addVerticalSeparator('gray');
                }
            }
        }
        if (!renderDependentTargetsIntervalId &&
            state === 'EXECUTING_DEPENDENT_TARGETS') {
            renderDependentTargetsIntervalId = setInterval(renderDependentTargets, 100);
        }
    };
    lifeCycle.printTaskTerminalOutput = (task, cacheStatus, terminalOutput) => {
        if (task.target.project === initiatingProject) {
            output_1.output.logCommandOutput(task.id, cacheStatus, terminalOutput);
        }
        else {
            tasksToTerminalOutputs[task.id] = terminalOutput;
        }
    };
    lifeCycle.endTasks = (taskResults) => {
        for (let t of taskResults) {
            totalCompletedTasks++;
            switch (t.status) {
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
                    /**
                     * A dependent project has failed so we stop executing and update the relevant
                     * dependent project task messaging
                     */
                    if (t.task.target.project !== initiatingProject) {
                        clearRenderInterval();
                        renderDependentTargets(false);
                        output_1.output.addVerticalSeparator('red');
                        output_1.output.logCommandOutput(t.task.id, t.status, tasksToTerminalOutputs[t.task.id]);
                    }
                    break;
            }
            delete tasksToTerminalOutputs[t.task.id];
        }
    };
    lifeCycle.endCommand = () => {
        clearRenderInterval();
        const timeTakenText = (0, pretty_time_1.prettyTime)(process.hrtime(start));
        if (totalSuccessfulTasks === totalTasks) {
            state = 'COMPLETED_SUCCESSFULLY';
            const text = `Successfully ran ${(0, formatting_utils_1.formatTargetsAndProjects)([initiatingProject], [targetName], tasks)}`;
            const taskOverridesLines = [];
            const filteredOverrides = Object.entries(overrides).filter(
            // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
            ([flag]) => flag !== 'nxReleaseVersionData');
            if (filteredOverrides.length > 0) {
                taskOverridesLines.push('');
                taskOverridesLines.push(`${EXTENDED_LEFT_PAD}${pc.dim(pc.green('With additional flags:'))}`);
                filteredOverrides
                    .map(([flag, value]) => pc.dim(pc.green((0, formatting_utils_1.formatFlags)(EXTENDED_LEFT_PAD, flag, value))))
                    .forEach((arg) => taskOverridesLines.push(arg));
            }
            const pinnedFooterLines = [
                output_1.output.applyNxPrefix('green', output_1.output.colors.green(text) + output_1.output.dim(` (${timeTakenText})`)),
                ...taskOverridesLines,
            ];
            if (totalCachedTasks > 0) {
                pinnedFooterLines.push(output_1.output.dim(`${os_1.EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`));
            }
            renderLines(pinnedFooterLines, 'green');
        }
        else {
            state = 'COMPLETED_WITH_ERRORS';
            let text = `Ran target ${output_1.output.bold(targetName)} for project ${output_1.output.bold(initiatingProject)}`;
            if (totalDependentTasks > 0) {
                text += ` and ${output_1.output.bold(totalDependentTasks)} task(s) they depend on`;
            }
            const taskOverridesLines = [];
            const filteredOverrides = Object.entries(overrides).filter(
            // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
            ([flag]) => flag !== 'nxReleaseVersionData');
            if (filteredOverrides.length > 0) {
                taskOverridesLines.push('');
                taskOverridesLines.push(`${EXTENDED_LEFT_PAD}${pc.dim(pc.red('With additional flags:'))}`);
                filteredOverrides
                    .map(([flag, value]) => pc.dim(pc.red((0, formatting_utils_1.formatFlags)(EXTENDED_LEFT_PAD, flag, value))))
                    .forEach((arg) => taskOverridesLines.push(arg));
            }
            const viewLogs = (0, view_logs_utils_1.viewLogsFooterRows)(totalFailedTasks);
            renderLines([
                output_1.output.applyNxPrefix('red', output_1.output.colors.red(text) + output_1.output.dim(` (${timeTakenText})`)),
                ...taskOverridesLines,
                '',
                `${LEFT_PAD}${output_1.output.colors.red(figures.cross)}${SPACER}${totalFailedTasks}${`/${totalCompletedTasks}`} failed`,
                `${LEFT_PAD}${output_1.output.dim(figures.tick)}${SPACER}${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output_1.output.dim(`[${totalCachedTasks} read from cache]`)}`,
                ...viewLogs,
            ], 'red');
        }
        resolveRenderIsDonePromise();
    };
    return { lifeCycle, renderIsDone };
}
