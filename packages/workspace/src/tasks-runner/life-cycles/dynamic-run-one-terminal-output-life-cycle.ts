import * as cliCursor from 'cli-cursor';
import { dots } from 'cli-spinners';
import { EOL } from 'os';
import * as readline from 'readline';
import { output } from '../../utilities/output';
import type { LifeCycle } from '../life-cycle';
import type { Task } from '../tasks-runner';
import { prettyTime } from './pretty-time';

/**
 * As tasks are completed the overall state moves from:
 * 1. EXECUTING_DEPENDENT_TARGETS (dynamic lines, including a spinner are reprinted, task outputs not shown)
 * 2. EXECUTING_INITIATING_PROJECT_TARGET (dynamic output effectively ends as initiating project tasks forward output)
 * 3. COMPLETED_SUCCESSFULLY or COMPLETED_WITH_ERRORS (footer messaging is appended to the previous output)
 */
type State =
  | 'EXECUTING_DEPENDENT_TARGETS'
  | 'EXECUTING_INITIATING_PROJECT_TARGET'
  | 'COMPLETED_SUCCESSFULLY'
  | 'COMPLETED_WITH_ERRORS';

/**
 * The following function is responsible for creating a life cycle with dynamic
 * outputs, meaning previous outputs can be rewritten or modified as new outputs
 * are added. It is therefore intended for use on a user's local machines.
 *
 * In CI environments the static equivalent of this life cycle should be used.
 */
export async function createRunOneDynamicOutputRenderer({
  initiatingProject,
  tasks,
  args,
  overrides,
}: {
  initiatingProject: string;
  tasks: Task[];
  args: { target?: string; configuration?: string; parallel?: number };
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
    if (renderDependentTargetsIntervalId) {
      clearInterval(renderDependentTargetsIntervalId);
    }
  }

  process.on('exit', () => clearRenderInterval());
  process.on('SIGINT', () => clearRenderInterval());
  process.on('SIGTERM', () => clearRenderInterval());
  process.on('SIGHUP', () => clearRenderInterval());

  const lifeCycle = {} as Partial<LifeCycle>;

  const start = process.hrtime();
  const figures = await import('figures');

  let state: State = 'EXECUTING_DEPENDENT_TARGETS';

  const tasksToTerminalOutputs: Record<string, string> = {};
  const totalTasks = tasks.length;
  const totalDependentTasks = totalTasks - 1;
  const totalTasksFromInitiatingProject = tasks.filter(
    (t) => t.target.project === initiatingProject
  ).length;
  // Tasks from the initiating project are treated differently, they forward their output
  const totalDependentTasksNotFromInitiatingProject =
    totalTasks - totalTasksFromInitiatingProject;

  const targetName = args.target;

  let dependentTargetsNumLines = 0;
  let totalCompletedTasks = 0;
  let totalSuccessfulTasks = 0;
  let totalFailedTasks = 0;
  let totalCachedTasks = 0;

  // Used to control the rendering of the spinner
  let dependentTargetsCurrentFrame = 0;
  let renderDependentTargetsIntervalId: NodeJS.Timeout | undefined;

  const clearDependentTargets = () => {
    for (let i = 0; i < dependentTargetsNumLines; i++) {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
    }
  };

  const renderLines = (
    lines: string[],
    dividerColor = 'cyan',
    renderDivider = true,
    skipPadding = false
  ) => {
    let additionalLines = 0;
    if (renderDivider) {
      output.addVerticalSeparator(dividerColor);
      additionalLines += 3;
    }
    if (renderDivider) {
      lines.push('');
    }
    for (const line of lines) {
      process.stdout.write((skipPadding ? '' : output.X_PADDING) + line + EOL);
    }
    dependentTargetsNumLines = lines.length + additionalLines;
  };

  const renderDependentTargets = (renderDivider = true) => {
    if (totalDependentTasksNotFromInitiatingProject <= 0) {
      return;
    }
    const max = dots.frames.length - 1;
    const curr = dependentTargetsCurrentFrame;
    dependentTargetsCurrentFrame = curr >= max ? 0 : curr + 1;

    const linesToRender: string[] = [''];
    const remainingDependentTasksNotFromInitiatingProject =
      totalDependentTasksNotFromInitiatingProject - totalCompletedTasks;

    switch (state) {
      case 'EXECUTING_DEPENDENT_TARGETS':
        if (totalFailedTasks === 0) {
          linesToRender.push(
            `   ${output.colors.cyan(
              dots.frames[dependentTargetsCurrentFrame]
            )}    ${output.colors.white.dim(
              `Nx is waiting on ${remainingDependentTasksNotFromInitiatingProject} dependent project tasks before running tasks from`
            )} ${output.colors.white(`${initiatingProject}`)}...`
          );
          if (totalSuccessfulTasks > 0) {
            linesToRender.push('');
          }
        }
        break;
    }

    if (totalFailedTasks > 0) {
      linesToRender.push(
        output.colors.red.dim(
          `   ${output.colors.red(
            figures.cross
          )}    ${totalFailedTasks}${`/${totalCompletedTasks}`} dependent project tasks failed (see below)`
        )
      );
    }

    if (totalSuccessfulTasks > 0) {
      linesToRender.push(
        output.colors.gray(
          `   ${output.colors.gray(
            figures.tick
          )}    ${totalSuccessfulTasks}${`/${totalCompletedTasks}`} dependent project tasks succeeded ${output.colors.gray.dim(
            `[${totalCachedTasks} read from cache]`
          )}`
        )
      );
    }

    clearDependentTargets();

    if (linesToRender.length > 1) {
      renderLines(
        linesToRender,
        'gray',
        renderDivider && state !== 'EXECUTING_DEPENDENT_TARGETS',
        true
      );
    } else {
      renderLines([]);
    }
  };

  lifeCycle.startCommand = () => {
    renderDependentTargets();
  };

  lifeCycle.startTasks = (tasks: Task[]) => {
    for (const task of tasks) {
      // Move from the dependent project tasks phase to the initiating project's targets
      if (
        task.target.project === initiatingProject &&
        state !== 'EXECUTING_INITIATING_PROJECT_TARGET'
      ) {
        state = 'EXECUTING_INITIATING_PROJECT_TARGET';
        clearRenderInterval();
        renderDependentTargets(false);
        if (totalDependentTasksNotFromInitiatingProject > 0) {
          output.addNewline();
          process.stdout.write(
            `   ${output.colors.gray(
              'Hint: you can run the command with'
            )} --verbose ${output.colors.gray(
              'to see the full dependent project outputs'
            )}` + EOL
          );
          output.addVerticalSeparator('gray');
        }
      }
    }
    if (
      !renderDependentTargetsIntervalId &&
      state === 'EXECUTING_DEPENDENT_TARGETS'
    ) {
      renderDependentTargetsIntervalId = setInterval(
        renderDependentTargets,
        100
      );
    }
  };

  lifeCycle.printTaskTerminalOutput = (task, cacheStatus, terminalOutput) => {
    if (task.target.project === initiatingProject) {
      output.logCommand(task.id, cacheStatus);
      output.addNewline();
      process.stdout.write(terminalOutput);
    } else {
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
            output.addVerticalSeparator('red');
            output.logCommand(t.task.id, t.status);
            output.addNewline();
            process.stdout.write(tasksToTerminalOutputs[t.task.id]);
          }
          break;
      }
      delete tasksToTerminalOutputs[t.task.id];
    }
  };

  lifeCycle.endCommand = () => {
    clearRenderInterval();
    const timeTakenText = prettyTime(process.hrtime(start));

    if (totalSuccessfulTasks === totalTasks) {
      state = 'COMPLETED_SUCCESSFULLY';

      let text = `Successfully ran target ${output.bold(
        targetName
      )} for project ${output.bold(initiatingProject)}`;
      if (totalDependentTasks > 0) {
        text += ` and ${output.bold(
          totalDependentTasks
        )} task(s) it depends on`;
      }

      const taskOverridesLines = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesLines.push('');
        taskOverridesLines.push(
          `${leftPadding}${output.dim.green('With additional flags:')}`
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.green(`${leftPadding}  --${flag}=${value}`)
          )
          .forEach((arg) => taskOverridesLines.push(arg));
      }

      const pinnedFooterLines = [
        output.applyNxPrefix(
          'green',
          output.colors.green(text) + output.dim.white(` (${timeTakenText})`)
        ),
        ...taskOverridesLines,
      ];
      if (totalCachedTasks > 0) {
        pinnedFooterLines.push(
          output.colors.gray(
            `${EOL}   Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
          )
        );
      }
      renderLines(pinnedFooterLines, 'green');
    } else {
      state = 'COMPLETED_WITH_ERRORS';

      let text = `Ran target ${output.bold(
        targetName
      )} for project ${output.bold(initiatingProject)}`;
      if (totalDependentTasks > 0) {
        text += ` and ${output.bold(
          totalDependentTasks
        )} task(s) it depends on`;
      }

      const taskOverridesLines = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesLines.push('');
        taskOverridesLines.push(
          `${leftPadding}${output.dim.red('With additional flags:')}`
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.red(`${leftPadding}  --${flag}=${value}`)
          )
          .forEach((arg) => taskOverridesLines.push(arg));
      }

      renderLines(
        [
          output.applyNxPrefix(
            'red',
            output.colors.red(text) + output.dim.white(` (${timeTakenText})`)
          ),
          ...taskOverridesLines,
          '',
          `   ${output.colors.red(
            figures.cross
          )}    ${totalFailedTasks}${`/${totalCompletedTasks}`} failed`,
          `   ${output.colors.gray(
            figures.tick
          )}    ${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.colors.gray(
            `[${totalCachedTasks} read from cache]`
          )}`,
        ],
        'red'
      );
    }
    resolveRenderIsDonePromise();
  };

  return { lifeCycle, renderIsDone };
}
