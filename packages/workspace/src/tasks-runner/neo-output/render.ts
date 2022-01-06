import * as chalk from 'chalk';
import { dots } from 'cli-spinners';
import { EOL } from 'os';
import * as readline from 'readline';
import type { Task, TaskStatus } from '../tasks-runner';
import { RunManyNeoTerminalOutputLifeCycle } from './life-cycle';
import { prettyTime } from './pretty-time';

const X_PADDING = ' ';

function applyNxPrefix(color = 'cyan', text: string) {
  return `${chalk[color]('>')} ${chalk.reset.inverse.bold[color](
    ' NX '
  )}  ${text}`;
}

function writeLine(line: string) {
  const additionalXPadding = '   ';
  process.stdout.write(X_PADDING + additionalXPadding + line + EOL);
}

function writeCommandOutputBlock(output: string) {
  const additionalXPadding = '      ';
  const lines = output.split(EOL);
  /**
   * There's not much we can do in order to "neaten up" the outputs of
   * commands we do not control, but at the very least we can trim excess
   * newlines so that there isn't unncecessary vertical whitespace.
   */
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
  process.stdout.write(
    lines.map((l) => `${X_PADDING}${additionalXPadding}${l}`).join(EOL) + EOL
  );
}

interface RenderConfig {
  lifeCycle: RunManyNeoTerminalOutputLifeCycle;
  projectNames: string[];
  tasks: Task[];
  args: { target?: string; configuration?: string };
}

export async function render({
  lifeCycle,
  projectNames,
  tasks,
  args,
}: RenderConfig): Promise<void> {
  const start = process.hrtime();
  const figures = await import('figures');

  let resolveIsRenderCompletePromise: (value: void) => void;
  const isRenderCompletePromise = new Promise<void>(
    (resolve) => (resolveIsRenderCompletePromise = resolve)
  );

  const totalTasks = tasks.length;
  const targetName = args.target;
  const totalProjects = projectNames.length;
  const projectRows = projectNames.map((projectName) => {
    return {
      projectName,
      status: 'pending',
    };
  });

  const tasksToTerminalOutputs: Record<string, string> = {};
  let hasTaskOutput = false;
  let pinnedFooterNumLines = 0;
  let totalCompletedTasks = 0;
  let totalSuccessfulTasks = 0;
  let totalFailedTasks = 0;
  let totalCachedTasks = 0;

  // Used to control the rendering of the spinner on each project row
  let projectRowsCurrentFrame = 0;
  let renderProjectRowsIntervalId: NodeJS.Timeout | undefined;

  const clearPinnedFooter = () => {
    for (let i = 0; i < pinnedFooterNumLines; i++) {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
    }
  };

  const renderPinnedFooter = (lines: string[], dividerColor = 'gray') => {
    let additionalLines = 0;
    if (hasTaskOutput) {
      let divider = '';
      for (let i = 0; i < process.stdout.columns - X_PADDING.length * 2; i++) {
        divider += '\u2014';
      }
      process.stdout.write(EOL);
      process.stdout.write(
        X_PADDING + chalk.dim[dividerColor](divider + EOL) + EOL
      );
      additionalLines += 3;
    }
    // Create vertical breathing room for cursor position under the pinned footer
    lines.push('');
    for (const line of lines) {
      process.stdout.write(X_PADDING + line + EOL);
    }
    pinnedFooterNumLines = lines.length + additionalLines;
  };

  const printTaskResult = (task: Task, status: TaskStatus) => {
    clearPinnedFooter();
    // If this is the very first output, add some vertical breathing room
    if (!hasTaskOutput) {
      process.stdout.write(EOL);
    }
    hasTaskOutput = true;

    switch (status) {
      case 'cache':
        writeLine(
          chalk.green(figures.tick) +
            chalk.dim.white('  nx run ') +
            chalk.white(task.id) +
            '  ' +
            chalk.gray('[from local cache]')
        );
        break;
      case 'remote-cache':
        writeLine(
          chalk.green(figures.tick) +
            chalk.dim('  nx run ') +
            task.id +
            '  ☁️  ' +
            chalk.gray('[from cloud cache]')
        );
        break;
      case 'success':
        writeLine(chalk.green(figures.tick) + chalk.dim('  nx run ') + task.id);
        break;
      case 'failure':
        process.stdout.write(EOL);
        writeLine(
          chalk.red(figures.cross) + chalk.dim('  nx run ') + chalk.red(task.id)
        );
        writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        break;
    }

    delete tasksToTerminalOutputs[task.id];
    renderPinnedFooter([]);
    renderProjectRows();
  };

  const renderProjectRows = () => {
    const max = dots.frames.length - 1;
    const curr = projectRowsCurrentFrame;
    projectRowsCurrentFrame = curr >= max ? 0 : curr + 1;

    const additionalFooterRows: string[] = [''];
    const runningTasks = projectRows.filter((row) => row.status === 'running');
    const pendingTasks = projectRows.filter((row) => row.status === 'pending');
    const remainingTasks = pendingTasks.length + runningTasks.length;

    if (runningTasks.length > 0) {
      additionalFooterRows.push(
        chalk.dim.cyan(
          `   ${figures.arrowRight}    Executing ${
            runningTasks.length
          }/${remainingTasks} remaining tasks${
            runningTasks.length > 1 ? ' in parallel' : ''
          }...`
        )
      );
      additionalFooterRows.push('');
      for (const projectRow of runningTasks) {
        additionalFooterRows.push(
          `   ${chalk.dim.cyan(
            dots.frames[projectRowsCurrentFrame]
          )}    ${chalk.dim.white(projectRow.projectName)}`
        );
      }
    }

    if (totalSuccessfulTasks > 0 || totalFailedTasks > 0) {
      additionalFooterRows.push('');
    }

    if (totalFailedTasks > 0) {
      additionalFooterRows.push(
        `   ${chalk.red(figures.cross)}    ${totalFailedTasks}${chalk.dim(
          `/${totalCompletedTasks}`
        )} failed`
      );
    }

    if (totalSuccessfulTasks > 0) {
      additionalFooterRows.push(
        `   ${chalk.green(figures.tick)}    ${totalSuccessfulTasks}${chalk.dim(
          `/${totalCompletedTasks}`
        )} succeeded ${chalk.gray(`[${totalCachedTasks} read from cache]`)}`
      );
    }

    clearPinnedFooter();

    if (additionalFooterRows.length > 1) {
      const pinnedFooterLines = [
        applyNxPrefix(
          'cyan',
          chalk.gray(
            `Running target ${chalk.bold.white(
              targetName
            )} for ${chalk.bold.white(totalProjects)} project(s)`
          )
        ),
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

  lifeCycle.callbacks.onStartCommand = (params) => {
    if (totalProjects <= 0) {
      let description = `with target "${targetName}"`;
      if (params.args.configuration) {
        description += ` that are configured for "${params.args.configuration}"`;
      }
      renderPinnedFooter([
        '',
        applyNxPrefix('gray', `No projects ${description} were run`),
      ]);
      resolveIsRenderCompletePromise();
      return;
    }
    renderPinnedFooter([]);
  };

  lifeCycle.callbacks.onStartTasks = (tasks) => {
    for (const projectRow of projectRows) {
      const matchedTask = tasks.find(
        (t) => t.target.project === projectRow.projectName
      );
      if (!matchedTask) {
        continue;
      }
      projectRow.status = 'running';
    }
    if (!renderProjectRowsIntervalId) {
      renderProjectRowsIntervalId = setInterval(renderProjectRows, 100);
    }
  };

  lifeCycle.callbacks.onPrintTaskTerminalOutput = (
    task,
    _cacheStatus,
    output
  ) => {
    tasksToTerminalOutputs[task.id] = output;
  };

  lifeCycle.callbacks.onEndTasks = (taskResults) => {
    totalCompletedTasks++;

    for (let t of taskResults) {
      const matchingProjectRow = projectRows.find(
        (pr) => pr.projectName === t.task.target.project
      );
      if (matchingProjectRow) {
        matchingProjectRow.status = t.status;
      }

      switch (t.status) {
        case 'remote-cache':
        case 'cache':
          totalCachedTasks++;
        case 'success':
          totalSuccessfulTasks++;
          break;
        case 'failure':
          totalFailedTasks++;
          break;
      }

      printTaskResult(t.task, t.status);
    }

    if (totalCompletedTasks === totalTasks) {
      if (renderProjectRowsIntervalId) {
        clearInterval(renderProjectRowsIntervalId);
      }
      const timeTakenText = prettyTime(process.hrtime(start));

      clearPinnedFooter();

      if (totalSuccessfulTasks === totalTasks) {
        const pinnedFooterLines = [
          applyNxPrefix(
            'green',
            chalk.green(
              `Successfully ran target ${chalk.bold(
                targetName
              )} for ${chalk.bold(totalProjects)} projects`
            ) + chalk.dim.white(` (${timeTakenText})`)
          ),
        ];
        if (totalCachedTasks > 0) {
          pinnedFooterLines.push(
            chalk.gray(
              `\n   Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
            )
          );
        }
        renderPinnedFooter(pinnedFooterLines, 'green');
      } else {
        renderPinnedFooter(
          [
            applyNxPrefix(
              'red',
              chalk.red(
                `Ran target ${chalk.bold(targetName)} for ${chalk.bold(
                  totalProjects
                )} projects`
              ) + chalk.dim.white(` (${timeTakenText})`)
            ),
            '',
            `   ${chalk.red(figures.cross)}    ${totalFailedTasks}${chalk.dim(
              `/${totalCompletedTasks}`
            )} failed`,
            `   ${chalk.gray(
              figures.tick
            )}    ${totalSuccessfulTasks}${chalk.dim(
              `/${totalCompletedTasks}`
            )} succeeded ${chalk.gray(
              `[${totalCachedTasks} read from cache]`
            )}`,
          ],
          'red'
        );
      }

      resolveIsRenderCompletePromise();
    }
  };

  return isRenderCompletePromise;
}
