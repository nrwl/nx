import * as cliCursor from 'cli-cursor';
import { dots } from 'cli-spinners';
import { EOL } from 'os';
import * as readline from 'readline';
import { output } from '../../utils/output';
import type { LifeCycle } from '../life-cycle';
import type { TaskStatus } from '../tasks-runner';
import { Task } from '../../config/task-graph';
import { prettyTime } from './pretty-time';
import { formatFlags, formatTargetsAndProjects } from './formatting-utils';
import { viewLogsFooterRows } from './view-logs-utils';

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
export async function createRunManyDynamicOutputRenderer({
  projectNames,
  tasks,
  args,
  overrides,
}: {
  projectNames: string[];
  tasks: Task[];
  args: { targets?: string[]; configuration?: string; parallel?: number };
  overrides: Record<string, unknown>;
}): Promise<{ lifeCycle: LifeCycle; renderIsDone: Promise<void> }> {
  cliCursor.hide();
  let resolveRenderIsDonePromise: (value: void) => void;
  const renderIsDone = new Promise<void>(
    (resolve) => (resolveRenderIsDonePromise = resolve)
  ).then(() => {
    clearRenderInterval();
    cliCursor.show();
  });

  function clearRenderInterval() {
    if (renderIntervalId) {
      clearInterval(renderIntervalId);
    }
  }

  process.on('exit', () => clearRenderInterval());
  process.on('SIGINT', () => clearRenderInterval());
  process.on('SIGTERM', () => clearRenderInterval());
  process.on('SIGHUP', () => clearRenderInterval());

  const lifeCycle = {} as Partial<LifeCycle>;
  const isVerbose = overrides.verbose === true;

  const start = process.hrtime();
  const figures = await import('figures');

  const targets = args.targets;
  const totalTasks = tasks.length;
  const taskRows = tasks.map((task) => {
    return {
      task,
      status: 'pending',
    };
  });

  const failedTasks = new Set();
  const tasksToTerminalOutputs: Record<string, string> = {};
  const tasksToProcessStartTimes: Record<
    string,
    ReturnType<NodeJS.HRTime>
  > = {};
  let hasTaskOutput = false;
  let pinnedFooterNumLines = 0;
  let totalCompletedTasks = 0;
  let totalSuccessfulTasks = 0;
  let totalFailedTasks = 0;
  let totalCachedTasks = 0;

  // Used to control the rendering of the spinner on each project row
  let currentFrame = 0;
  let renderIntervalId: NodeJS.Timeout | undefined;

  const moveCursorToStartOfPinnedFooter = () => {
    readline.moveCursor(process.stdout, 0, -pinnedFooterNumLines);
  };

  const renderPinnedFooter = (lines: string[], dividerColor = 'cyan') => {
    let additionalLines = 0;
    if (hasTaskOutput) {
      const dividerLines = output.getVerticalSeparatorLines(dividerColor);
      for (const line of dividerLines) {
        output.overwriteLine(line);
      }
      additionalLines += dividerLines.length;
    }
    // Create vertical breathing room for cursor position under the pinned footer
    lines.push('');
    for (const line of lines) {
      output.overwriteLine(output.X_PADDING + line);
    }
    pinnedFooterNumLines = lines.length + additionalLines;
    // clear any possible text below the cursor's position
    readline.clearScreenDown(process.stdout);
  };

  const printTaskResult = (task: Task, status: TaskStatus) => {
    moveCursorToStartOfPinnedFooter();
    // If this is the very first output, add some vertical breathing room
    if (!hasTaskOutput) {
      output.addNewline();
    }
    hasTaskOutput = true;

    switch (status) {
      case 'local-cache':
        writeCompletedTaskResultLine(
          `${
            output.colors.green(figures.tick) +
            '  ' +
            output.formatCommand(task.id)
          }  ${output.dim('[local cache]')}`
        );
        if (isVerbose) {
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        }
        break;
      case 'local-cache-kept-existing':
        writeCompletedTaskResultLine(
          `${
            output.colors.green(figures.tick) +
            '  ' +
            output.formatCommand(task.id)
          }  ${output.dim('[existing outputs match the cache, left as is]')}`
        );
        if (isVerbose) {
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        }
        break;
      case 'remote-cache':
        writeCompletedTaskResultLine(
          `${
            output.colors.green(figures.tick) +
            '  ' +
            output.formatCommand(task.id)
          }  ${output.dim('[remote cache]')}`
        );
        if (isVerbose) {
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        }
        break;
      case 'success': {
        const timeTakenText = prettyTime(
          process.hrtime(tasksToProcessStartTimes[task.id])
        );
        writeCompletedTaskResultLine(
          output.colors.green(figures.tick) +
            '  ' +
            output.formatCommand(task.id) +
            output.dim(` (${timeTakenText})`)
        );
        if (isVerbose) {
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        }
        break;
      }
      case 'failure':
        output.addNewline();
        writeCompletedTaskResultLine(
          output.colors.red(figures.cross) +
            '  ' +
            output.formatCommand(output.colors.red(task.id))
        );
        writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        break;
    }

    delete tasksToTerminalOutputs[task.id];
    renderPinnedFooter([]);
    renderRows();
  };

  const renderRows = () => {
    const max = dots.frames.length - 1;
    const curr = currentFrame;
    currentFrame = curr >= max ? 0 : curr + 1;

    const additionalFooterRows: string[] = [''];
    const runningTasks = taskRows.filter((row) => row.status === 'running');
    const remainingTasks = totalTasks - totalCompletedTasks;

    if (runningTasks.length > 0) {
      additionalFooterRows.push(
        output.dim(
          `   ${output.colors.cyan(figures.arrowRight)}    Executing ${
            runningTasks.length
          }/${remainingTasks} remaining tasks${
            runningTasks.length > 1 ? ' in parallel' : ''
          }...`
        )
      );
      additionalFooterRows.push('');
      for (const runningTask of runningTasks) {
        additionalFooterRows.push(
          `   ${output.dim.cyan(
            dots.frames[currentFrame]
          )}    ${output.formatCommand(runningTask.task.id)}`
        );
      }
      /**
       * Reduce layout thrashing by ensuring that there is a relatively consistent
       * height for the area in which the task rows are rendered.
       *
       * We can look at the parallel flag to know how many rows are likely to be
       * needed in the common case and always render that at least that many.
       */
      if (
        totalCompletedTasks !== totalTasks &&
        Number.isInteger(args.parallel) &&
        runningTasks.length < args.parallel
      ) {
        // Don't bother with this optimization if there are fewer tasks remaining than rows required
        if (remainingTasks >= args.parallel) {
          for (let i = runningTasks.length; i < args.parallel; i++) {
            additionalFooterRows.push('');
          }
        }
      }
    }

    if (totalSuccessfulTasks > 0 || totalFailedTasks > 0) {
      additionalFooterRows.push('');
    }

    if (totalSuccessfulTasks > 0) {
      additionalFooterRows.push(
        `   ${output.colors.green(
          figures.tick
        )}    ${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
          `[${totalCachedTasks} read from cache]`
        )}`
      );
    }

    if (totalFailedTasks > 0) {
      additionalFooterRows.push(
        `   ${output.colors.red(
          figures.cross
        )}    ${totalFailedTasks}${`/${totalCompletedTasks}`} failed`
      );
    }

    moveCursorToStartOfPinnedFooter();

    if (additionalFooterRows.length > 1) {
      const text = `Running ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks
      )}`;
      const taskOverridesRows = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${leftPadding}${output.dim.cyan('With additional flags:')}`
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.cyan(formatFlags(leftPadding, flag, value))
          )
          .forEach((arg) => taskOverridesRows.push(arg));
      }

      const pinnedFooterLines = [
        output.applyNxPrefix('cyan', output.colors.cyan(text)),
        ...taskOverridesRows,
        ...additionalFooterRows,
      ];

      // Vertical breathing room when there isn't yet any output or divider
      if (!hasTaskOutput) {
        pinnedFooterLines.unshift('');
      }

      renderPinnedFooter(pinnedFooterLines);
    } else {
      renderPinnedFooter([]);
    }
  };

  lifeCycle.startCommand = () => {
    if (projectNames.length <= 0) {
      renderPinnedFooter([
        '',
        output.applyNxPrefix(
          'gray',
          `No projects with ${formatTargetsAndProjects(
            projectNames,
            targets,
            tasks
          )} were run`
        ),
      ]);
      resolveRenderIsDonePromise();
      return;
    }
    renderPinnedFooter([]);
  };

  lifeCycle.endCommand = () => {
    clearRenderInterval();
    const timeTakenText = prettyTime(process.hrtime(start));

    moveCursorToStartOfPinnedFooter();
    if (totalSuccessfulTasks === totalTasks) {
      const text = `Successfully ran ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks
      )}`;
      const taskOverridesRows = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${leftPadding}${output.dim.green('With additional flags:')}`
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.green(formatFlags(leftPadding, flag, value))
          )
          .forEach((arg) => taskOverridesRows.push(arg));
      }

      const pinnedFooterLines = [
        output.applyNxPrefix(
          'green',
          output.colors.green(text) + output.dim.white(` (${timeTakenText})`)
        ),
        ...taskOverridesRows,
      ];
      if (totalCachedTasks > 0) {
        pinnedFooterLines.push(
          output.dim(
            `${EOL}   Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
          )
        );
      }
      renderPinnedFooter(pinnedFooterLines, 'green');
    } else {
      const text = `Ran ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks
      )}`;
      const taskOverridesRows = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${leftPadding}${output.dim.red('With additional flags:')}`
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.red(formatFlags(leftPadding, flag, value))
          )
          .forEach((arg) => taskOverridesRows.push(arg));
      }

      const numFailedToPrint = 5;
      const failedTasksForPrinting = Array.from(failedTasks).slice(
        0,
        numFailedToPrint
      );
      const failureSummaryRows = [
        output.applyNxPrefix(
          'red',
          output.colors.red(text) + output.dim.white(` (${timeTakenText})`)
        ),
        ...taskOverridesRows,
        '',
        output.dim(
          `   ${output.dim(
            figures.tick
          )}    ${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
            `[${totalCachedTasks} read from cache]`
          )}`
        ),
        '',
        `   ${output.colors.red(
          figures.cross
        )}    ${totalFailedTasks}${`/${totalCompletedTasks}`} targets failed, including the following:`,
        `${failedTasksForPrinting
          .map(
            (t) =>
              `        ${output.colors.red('-')} ${output.formatCommand(
                t.toString()
              )}`
          )
          .join('\n ')}`,
      ];

      if (failedTasks.size > numFailedToPrint) {
        failureSummaryRows.push(
          output.dim(
            `        ...and ${failedTasks.size - numFailedToPrint} more...`
          )
        );
      }

      failureSummaryRows.push(...viewLogsFooterRows(failedTasks.size));

      renderPinnedFooter(failureSummaryRows, 'red');
    }
    resolveRenderIsDonePromise();
  };

  lifeCycle.startTasks = (tasks: Task[]) => {
    for (const task of tasks) {
      tasksToProcessStartTimes[task.id] = process.hrtime();
    }
    for (const taskRow of taskRows) {
      if (tasks.indexOf(taskRow.task) > -1) {
        taskRow.status = 'running';
      }
    }
    if (!renderIntervalId) {
      renderIntervalId = setInterval(renderRows, 100);
    }
  };

  lifeCycle.printTaskTerminalOutput = (task, _cacheStatus, output) => {
    tasksToTerminalOutputs[task.id] = output;
  };

  lifeCycle.endTasks = (taskResults) => {
    for (let t of taskResults) {
      totalCompletedTasks++;
      const matchingTaskRow = taskRows.find((r) => r.task.id === t.task.id);
      if (matchingTaskRow) {
        matchingTaskRow.status = t.status;
      }

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
          failedTasks.add(t.task.id);
          break;
      }
      printTaskResult(t.task, t.status);
    }
  };

  return { lifeCycle, renderIsDone };
}

function writeCompletedTaskResultLine(line: string) {
  const additionalXPadding = '   ';
  output.overwriteLine(output.X_PADDING + additionalXPadding + line);
}

/**
 * There's not much we can do in order to "neaten up" the outputs of
 * commands we do not control, but at the very least we can trim any
 * leading whitespace and any _excess_ trailing newlines so that there
 * isn't unncecessary vertical whitespace.
 */
function writeCommandOutputBlock(commandOutput: string) {
  commandOutput = commandOutput || '';
  commandOutput = commandOutput.trimStart();
  const additionalXPadding = '      ';
  const lines = commandOutput.split(EOL);
  let totalTrailingEmptyLines = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] !== '') {
      break;
    }
    totalTrailingEmptyLines++;
  }
  if (totalTrailingEmptyLines > 1) {
    const linesToRemove = totalTrailingEmptyLines - 1;
    lines.splice(lines.length - linesToRemove, linesToRemove);
  }
  lines.push('');
  // Indent the command output to make it look more "designed" in the context of the dynamic output
  lines.forEach((l) =>
    output.overwriteLine(`${output.X_PADDING}${additionalXPadding}${l}`)
  );
}
