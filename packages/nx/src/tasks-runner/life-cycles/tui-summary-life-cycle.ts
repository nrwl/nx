import { EOL } from 'node:os';
import { TaskStatus as NativeTaskStatus } from '../../native';
import { Task, TaskGraph } from '../../config/task-graph';
import { output } from '../../utils/output';
import type { LifeCycle } from '../life-cycle';
import type { TaskStatus } from '../tasks-runner';
import { formatFlags, formatTargetsAndProjects } from './formatting-utils';
import { prettyTime } from './pretty-time';
import { viewLogsFooterRows } from './view-logs-utils';
import * as figures from 'figures';
import { getTasksHistoryLifeCycle } from './task-history-life-cycle';
import { getLeafTasks } from '../task-graph-utils';

const LEFT_PAD = `   `;
const SPACER = `  `;
const EXTENDED_LEFT_PAD = `      `;

export function getTuiTerminalSummaryLifeCycle({
  projectNames,
  tasks,
  taskGraph,
  args,
  overrides,
  initiatingProject,
  initiatingTasks,
  resolveRenderIsDonePromise,
}: {
  projectNames: string[];
  tasks: Task[];
  taskGraph: TaskGraph;
  args: { targets?: string[]; configuration?: string; parallel?: number };
  overrides: Record<string, unknown>;
  initiatingProject: string;
  initiatingTasks: Task[];
  resolveRenderIsDonePromise: (value: void) => void;
}) {
  const lifeCycle = {} as Partial<LifeCycle>;

  const start = process.hrtime();
  const targets = args.targets;
  const totalTasks = tasks.length;

  let totalCachedTasks = 0;
  let totalSuccessfulTasks = 0;
  let totalFailedTasks = 0;
  let totalCompletedTasks = 0;
  let timeTakenText: string;

  const failedTasks = new Set<string>();
  const inProgressTasks = new Set<string>();
  const stoppedTasks = new Set<string>();

  const tasksToTerminalOutputs: Record<string, string> = {};
  const tasksToTaskStatus: Record<string, TaskStatus> = {};

  const taskIdsInTheOrderTheyStart: string[] = [];

  lifeCycle.startTasks = (tasks) => {
    for (let t of tasks) {
      tasksToTerminalOutputs[t.id] ??= '';
      taskIdsInTheOrderTheyStart.push(t.id);
      inProgressTasks.add(t.id);
    }
  };

  lifeCycle.appendTaskOutput = (taskId, output) => {
    tasksToTerminalOutputs[taskId] += output;
  };

  // TODO(@AgentEnder): The following 2 methods should be one but will need more refactoring
  lifeCycle.printTaskTerminalOutput = (task, taskStatus) => {
    tasksToTaskStatus[task.id] = taskStatus;
  };
  lifeCycle.setTaskStatus = (taskId, taskStatus) => {
    if (taskStatus === NativeTaskStatus.Stopped) {
      stoppedTasks.add(taskId);
      inProgressTasks.delete(taskId);
    }
  };

  lifeCycle.endTasks = (taskResults) => {
    for (const { task, status } of taskResults) {
      totalCompletedTasks++;
      inProgressTasks.delete(task.id);

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
      }
    }
  };

  lifeCycle.endCommand = () => {
    timeTakenText = prettyTime(process.hrtime(start));
    resolveRenderIsDonePromise();
  };

  const printSummary = () => {
    const isRunOne = initiatingProject && targets?.length === 1;

    // Handles when the user interrupts the process
    timeTakenText ??= prettyTime(process.hrtime(start));

    if (totalTasks === 0) {
      console.log(`\n${output.applyNxPrefix('gray', 'No tasks were run')}\n`);
      return;
    }

    const failure = totalSuccessfulTasks + stoppedTasks.size !== totalTasks;
    const cancelled =
      // Some tasks were in progress...
      inProgressTasks.size > 0 ||
      // or some tasks had not started yet
      totalTasks !== tasks.length ||
      // the run had a continous task as a leaf...
      // this is needed because continous tasks get marked as stopped when the process is interrupted
      [...getLeafTasks(taskGraph)].filter((t) => taskGraph.tasks[t].continuous)
        .length > 0;

    if (isRunOne) {
      printRunOneSummary({
        failure,
        cancelled,
      });
    } else {
      printRunManySummary({
        failure,
        cancelled,
      });
    }
    getTasksHistoryLifeCycle().printFlakyTasksMessage();
  };

  const printRunOneSummary = ({
    failure,
    cancelled,
  }: {
    failure: boolean;
    cancelled: boolean;
  }) => {
    let lines: string[] = [];

    // Prints task outputs in the order they were completed
    // above the summary, since run-one should print all task results.
    for (const taskId of taskIdsInTheOrderTheyStart) {
      const taskStatus = tasksToTaskStatus[taskId];
      const terminalOutput = tasksToTerminalOutputs[taskId];
      output.logCommandOutput(taskId, taskStatus, terminalOutput);
    }

    lines.push(...output.getVerticalSeparatorLines(failure ? 'red' : 'green'));

    if (!failure && !cancelled) {
      const text = `Successfully ran ${formatTargetsAndProjects(
        [initiatingProject],
        targets,
        tasks
      )}`;

      const taskOverridesLines = [];
      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        taskOverridesLines.push('');
        taskOverridesLines.push(
          `${EXTENDED_LEFT_PAD}${output.dim.green('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.green(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => taskOverridesLines.push(arg));
      }

      lines.push(
        output.applyNxPrefix(
          'green',
          output.colors.green(text) + output.dim(` (${timeTakenText})`)
        ),
        ...taskOverridesLines
      );

      if (totalCachedTasks > 0) {
        lines.push(
          output.dim(
            `${EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
          )
        );
      }
      lines = [output.colors.green(lines.join(EOL))];
    } else if (!cancelled) {
      let text = `Ran target ${output.bold(
        targets[0]
      )} for project ${output.bold(initiatingProject)}`;
      if (tasks.length > 1) {
        text += ` and ${output.bold(tasks.length - 1)} task(s) they depend on`;
      }

      const taskOverridesLines: string[] = [];
      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        taskOverridesLines.push('');
        taskOverridesLines.push(
          `${EXTENDED_LEFT_PAD}${output.dim.red('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.red(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => taskOverridesLines.push(arg));
      }

      const viewLogs = viewLogsFooterRows(totalFailedTasks);

      lines.push(
        output.colors.red(
          [
            output.applyNxPrefix(
              'red',
              output.colors.red(text) + output.dim(` (${timeTakenText})`)
            ),
            ...taskOverridesLines,
            '',
            `${LEFT_PAD}${output.colors.red(
              figures.cross
            )}${SPACER}${totalFailedTasks}${`/${totalCompletedTasks}`} failed`,
            `${LEFT_PAD}${output.dim(
              figures.tick
            )}${SPACER}${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
              `[${totalCachedTasks} read from cache]`
            )}`,
            ...viewLogs,
          ].join(EOL)
        )
      );
    } else {
      lines.push(
        output.applyNxPrefix(
          'red',
          output.colors.red(
            `Cancelled running target ${output.bold(
              targets[0]
            )} for project ${output.bold(initiatingProject)}`
          ) + output.dim(` (${timeTakenText})`)
        )
      );
    }

    // adds some vertical space after the summary to avoid bunching against terminal
    lines.push('');

    console.log(lines.join(EOL));
  };

  const printRunManySummary = ({
    failure,
    cancelled,
  }: {
    failure: boolean;
    cancelled: boolean;
  }) => {
    console.log('');

    const lines: string[] = [''];

    for (const taskId of taskIdsInTheOrderTheyStart) {
      const taskStatus = tasksToTaskStatus[taskId];
      const terminalOutput = tasksToTerminalOutputs[taskId];
      // Task Status is null?
      if (!taskStatus) {
        output.logCommandOutput(taskId, taskStatus, terminalOutput);
        output.addNewline();
        lines.push(
          `${LEFT_PAD}${output.colors.cyan(
            figures.squareSmallFilled
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      } else if (taskStatus === 'failure') {
        output.logCommandOutput(taskId, taskStatus, terminalOutput);
        output.addNewline();
        lines.push(
          `${LEFT_PAD}${output.colors.red(
            figures.cross
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      } else {
        lines.push(
          `${LEFT_PAD}${output.colors.green(
            figures.tick
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      }
    }

    lines.push(...output.getVerticalSeparatorLines(failure ? 'red' : 'green'));

    if (totalSuccessfulTasks + stoppedTasks.size === totalTasks) {
      const successSummaryRows = [];
      const text = `Successfully ran ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks
      )}`;
      const taskOverridesRows = [];
      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${EXTENDED_LEFT_PAD}${output.dim.green('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.green(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => taskOverridesRows.push(arg));
      }

      successSummaryRows.push(
        ...[
          output.applyNxPrefix(
            'green',
            output.colors.green(text) + output.dim.white(` (${timeTakenText})`)
          ),
          ...taskOverridesRows,
        ]
      );
      if (totalCachedTasks > 0) {
        successSummaryRows.push(
          output.dim(
            `${EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
          )
        );
      }
      lines.push(successSummaryRows.join(EOL));
    } else {
      const text = `${
        cancelled ? 'Cancelled while running' : 'Ran'
      } ${formatTargetsAndProjects(projectNames, targets, tasks)}`;
      const taskOverridesRows: string[] = [];
      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${EXTENDED_LEFT_PAD}${output.dim.red('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.red(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => taskOverridesRows.push(arg));
      }

      const numFailedToPrint = 5;
      const failedTasksForPrinting = Array.from(failedTasks).slice(
        0,
        numFailedToPrint
      );
      const failureSummaryRows: string[] = [
        output.applyNxPrefix(
          'red',
          output.colors.red(text) + output.dim.white(` (${timeTakenText})`)
        ),
        ...taskOverridesRows,
        '',
      ];
      if (totalCompletedTasks > 0) {
        if (totalSuccessfulTasks > 0) {
          failureSummaryRows.push(
            output.dim(
              `${LEFT_PAD}${output.dim(
                figures.tick
              )}${SPACER}${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
                `[${totalCachedTasks} read from cache]`
              )}`
            ),
            ''
          );
        }
        if (totalFailedTasks > 0) {
          failureSummaryRows.push(
            `${LEFT_PAD}${output.colors.red(
              figures.cross
            )}${SPACER}${totalFailedTasks}${`/${totalCompletedTasks}`} targets failed, including the following:`,
            '',
            `${failedTasksForPrinting
              .map(
                (t) =>
                  `${EXTENDED_LEFT_PAD}${output.colors.red(
                    '-'
                  )} ${output.formatCommand(t.toString())}`
              )
              .join('\n')}`,
            ''
          );
          if (failedTasks.size > numFailedToPrint) {
            failureSummaryRows.push(
              output.dim(
                `${EXTENDED_LEFT_PAD}...and ${
                  failedTasks.size - numFailedToPrint
                } more...`
              )
            );
          }
        }
        if (totalCompletedTasks !== totalTasks) {
          const remainingTasks = totalTasks - totalCompletedTasks;
          if (inProgressTasks.size) {
            failureSummaryRows.push(
              `${LEFT_PAD}${output.colors.red(figures.ellipsis)}${SPACER}${
                inProgressTasks.size
              }${`/${totalTasks}`} targets were in progress, including the following:`,
              '',
              `${Array.from(inProgressTasks)
                .map(
                  (t) =>
                    `${EXTENDED_LEFT_PAD}${output.colors.red(
                      '-'
                    )} ${output.formatCommand(t.toString())}`
                )
                .join(EOL)}`,
              ''
            );
          }
          if (remainingTasks - inProgressTasks.size > 0) {
            failureSummaryRows.push(
              output.dim(
                `${LEFT_PAD}${output.colors.red(figures.ellipsis)}${SPACER}${
                  remainingTasks - inProgressTasks.size
                }${`/${totalTasks}`} targets had not started.`
              ),
              ''
            );
          }
        }

        failureSummaryRows.push(...viewLogsFooterRows(failedTasks.size));

        lines.push(output.colors.red(failureSummaryRows.join(EOL)));
      }
    }

    // adds some vertical space after the summary to avoid bunching against terminal
    lines.push('');

    console.log(lines.join(EOL));
  };
  return { lifeCycle, printSummary };
}
