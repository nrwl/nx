import { EOL } from 'node:os';
import { TaskStatus as NativeTaskStatus } from '../../native/index.js';
import { Task, TaskGraph } from '../../config/task-graph.js';
import { output } from '../../utils/output.js';
import type { LifeCycle } from '../life-cycle';
import type { TaskStatus } from '../tasks-runner';
import { formatFlags, formatTargetsAndProjects } from './formatting-utils.js';
import { prettyTime } from './pretty-time.js';
import { viewLogsFooterRows } from './view-logs-utils.js';
import * as figures from 'figures';
import { getTasksHistoryLifeCycle } from './task-history-life-cycle.js';
import { getLeafTasks } from '../task-graph-utils.js';

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
  lifeCycle.printTaskTerminalOutput = (task, taskStatus, output) => {
    tasksToTaskStatus[task.id] = taskStatus;
    // Store the complete output for display in the summary
    // This is called with the full output for cached and executed tasks
    if (output) {
      tasksToTerminalOutputs[task.id] = output;
    }
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
    // Prints task outputs in the order they were completed
    // above the summary, since run-one should print all task results.
    for (const taskId of taskIdsInTheOrderTheyStart) {
      const taskStatus = tasksToTaskStatus[taskId];
      const terminalOutput = tasksToTerminalOutputs[taskId];
      output.logCommandOutput(taskId, taskStatus, terminalOutput);
    }

    // Print vertical separator
    const separatorLines = output.getVerticalSeparatorLines(
      failure ? 'red' : 'green'
    );
    for (const line of separatorLines) {
      console.log(line);
    }

    if (!failure && !cancelled) {
      const text = `Successfully ran ${formatTargetsAndProjects(
        [initiatingProject],
        targets,
        tasks
      )}`;

      // Build success message with color applied to the entire block
      const messageLines = [
        output.applyNxPrefix(
          'green',
          output.colors.green(text) + output.dim(` (${timeTakenText})`)
        ),
      ];

      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        messageLines.push('');
        messageLines.push(
          `${EXTENDED_LEFT_PAD}${output.dim.green('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.green(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => messageLines.push(arg));
      }

      if (totalCachedTasks > 0) {
        messageLines.push(
          output.dim(
            `${EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
          )
        );
      }

      // Print the entire success message block with green color
      console.log(output.colors.green(messageLines.join(EOL)));
    } else if (!cancelled) {
      let text = `Ran target ${output.bold(
        targets[0]
      )} for project ${output.bold(initiatingProject)}`;
      if (tasks.length > 1) {
        text += ` and ${output.bold(tasks.length - 1)} task(s) they depend on`;
      }

      // Build failure message lines
      const messageLines = [
        output.applyNxPrefix(
          'red',
          output.colors.red(text) + output.dim(` (${timeTakenText})`)
        ),
      ];

      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        messageLines.push('');
        messageLines.push(
          `${EXTENDED_LEFT_PAD}${output.dim.red('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.red(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => messageLines.push(arg));
      }

      messageLines.push('');
      messageLines.push(
        `${LEFT_PAD}${output.colors.red(
          figures.cross
        )}${SPACER}${totalFailedTasks}${`/${totalCompletedTasks}`} failed`
      );
      messageLines.push(
        `${LEFT_PAD}${output.dim(
          figures.tick
        )}${SPACER}${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
          `[${totalCachedTasks} read from cache]`
        )}`
      );

      const viewLogs = viewLogsFooterRows(totalFailedTasks);
      messageLines.push(...viewLogs);

      // Print the entire failure message block with red color
      console.log(output.colors.red(messageLines.join(EOL)));
    } else {
      console.log(
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
    console.log('');
  };

  const printRunManySummary = ({
    failure,
    cancelled,
  }: {
    failure: boolean;
    cancelled: boolean;
  }) => {
    console.log('');

    // Collect checklist lines to print after task outputs
    const checklistLines: string[] = [];

    // First pass: Print task outputs and collect checklist lines
    for (const taskId of taskIdsInTheOrderTheyStart) {
      const taskStatus = tasksToTaskStatus[taskId];
      const terminalOutput = tasksToTerminalOutputs[taskId];
      // Task Status is null?
      if (!taskStatus) {
        output.logCommandOutput(taskId, taskStatus, terminalOutput);
        output.addNewline();
        checklistLines.push(
          `${LEFT_PAD}${output.colors.cyan(
            figures.squareSmallFilled
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      } else if (taskStatus === 'failure') {
        output.logCommandOutput(taskId, taskStatus, terminalOutput);
        output.addNewline();
        checklistLines.push(
          `${LEFT_PAD}${output.colors.red(
            figures.cross
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      } else if (taskStatus === 'local-cache') {
        checklistLines.push(
          `${LEFT_PAD}${output.colors.green(
            figures.tick
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}  ${output.dim(
            '[local cache]'
          )}`
        );
      } else if (taskStatus === 'local-cache-kept-existing') {
        checklistLines.push(
          `${LEFT_PAD}${output.colors.green(
            figures.tick
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}  ${output.dim(
            '[existing outputs match the cache, left as is]'
          )}`
        );
      } else if (taskStatus === 'remote-cache') {
        checklistLines.push(
          `${LEFT_PAD}${output.colors.green(
            figures.tick
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}  ${output.dim(
            '[remote cache]'
          )}`
        );
      } else if (taskStatus === 'success') {
        checklistLines.push(
          `${LEFT_PAD}${output.colors.green(
            figures.tick
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      } else {
        checklistLines.push(
          `${LEFT_PAD}${output.colors.green(
            figures.tick
          )}${SPACER}${output.colors.gray('nx run ')}${taskId}`
        );
      }
    }

    // Print all checklist lines together
    console.log();
    for (const line of checklistLines) {
      console.log(line);
    }

    // Print vertical separator
    const separatorLines = output.getVerticalSeparatorLines(
      failure ? 'red' : 'green'
    );
    for (const line of separatorLines) {
      console.log(line);
    }

    if (totalSuccessfulTasks + stoppedTasks.size === totalTasks) {
      const text = `Successfully ran ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks
      )}`;

      const successSummaryRows = [
        output.applyNxPrefix(
          'green',
          output.colors.green(text) + output.dim.white(` (${timeTakenText})`)
        ),
      ];

      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        successSummaryRows.push('');
        successSummaryRows.push(
          `${EXTENDED_LEFT_PAD}${output.dim.green('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.green(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => successSummaryRows.push(arg));
      }

      if (totalCachedTasks > 0) {
        successSummaryRows.push(
          output.dim(
            `${EOL}Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`
          )
        );
      }

      console.log(successSummaryRows.join(EOL));
    } else {
      const text = `${
        cancelled ? 'Cancelled while running' : 'Ran'
      } ${formatTargetsAndProjects(projectNames, targets, tasks)}`;

      const failureSummaryRows: string[] = [
        output.applyNxPrefix(
          'red',
          output.colors.red(text) + output.dim.white(` (${timeTakenText})`)
        ),
      ];

      const filteredOverrides = Object.entries(overrides).filter(
        // Don't print the data passed through from the version subcommand to the publish executor options, it could be quite large and it's an implementation detail.
        ([flag]) => flag !== 'nxReleaseVersionData'
      );
      if (filteredOverrides.length > 0) {
        failureSummaryRows.push('');
        failureSummaryRows.push(
          `${EXTENDED_LEFT_PAD}${output.dim.red('With additional flags:')}`
        );
        filteredOverrides
          .map(([flag, value]) =>
            output.dim.red(formatFlags(EXTENDED_LEFT_PAD, flag, value))
          )
          .forEach((arg) => failureSummaryRows.push(arg));
      }

      failureSummaryRows.push('');

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
          const numFailedToPrint = 5;
          const failedTasksForPrinting = Array.from(failedTasks).slice(
            0,
            numFailedToPrint
          );
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
      }

      console.log(output.colors.red(failureSummaryRows.join(EOL)));
    }

    // adds some vertical space after the summary to avoid bunching against terminal
    console.log('');
  };
  return { lifeCycle: lifeCycle as LifeCycle, printSummary };
}
