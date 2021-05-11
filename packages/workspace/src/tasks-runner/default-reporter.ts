import { output } from '../utilities/output';
import type { Task } from '@nrwl/devkit';
import { Reporter, ReporterArgs } from './reporter';

export class DefaultReporter implements Reporter {
  private projectNames: string[];

  beforeRun(
    projectNames: string[],
    tasks: Task[],
    args: ReporterArgs,
    taskOverrides: any
  ) {
    this.projectNames = projectNames;

    if (projectNames.length <= 0) {
      let description = `with "${args.target}"`;
      if (args.configuration) {
        description += ` that are configured for "${args.configuration}"`;
      }
      output.logSingleLine(`No projects ${description} were run`);
      return;
    }

    const bodyLines = projectNames.map(
      (affectedProject) => `${output.colors.gray('-')} ${affectedProject}`
    );
    if (Object.keys(taskOverrides).length > 0) {
      bodyLines.push('');
      bodyLines.push(`${output.colors.gray('With flags:')}`);
      Object.entries(taskOverrides)
        .map(([flag, value]) => `  --${flag}=${value}`)
        .forEach((arg) => bodyLines.push(arg));
    }

    let title = `${output.colors.gray('Running target')} ${
      args.target
    } ${output.colors.gray(`for`)} ${projectNames.length} project(s)`;
    const dependentTasksCount = tasks.length - projectNames.length;
    if (dependentTasksCount > 0) {
      title += ` ${output.colors.gray(`and`)} ${
        tasks.length - projectNames.length
      } task(s) ${output.colors.gray(`they depend on`)}`;
    }
    title += ':';

    output.log({
      title,
      bodyLines,
    });

    output.addVerticalSeparatorWithoutNewLines();
  }

  printResults(
    args: ReporterArgs,
    startedWithFailedProjects: boolean,
    tasks: Task[],
    failedTasks: Task[],
    tasksWithFailedDependencies: Task[],
    cachedTasks: Task[]
  ) {
    output.addNewline();
    output.addVerticalSeparatorWithoutNewLines();

    if (failedTasks.length === 0) {
      const bodyLines =
        cachedTasks.length > 0
          ? [
              output.colors.gray(
                `Nx read the output from cache instead of running the command for ${cachedTasks.length} out of ${tasks.length} tasks.`
              ),
            ]
          : [];

      output.success({
        title: `Running target "${args.target}" succeeded`,
        bodyLines,
      });

      if (args.onlyFailed && startedWithFailedProjects) {
        output.warn({
          title: `Only projects ${output.underline(
            'which had previously failed'
          )} were run`,
          bodyLines: [
            `You should verify by running ${output.underline(
              'without'
            )} ${output.bold('--only-failed')}`,
          ],
        });
      }
    } else {
      const bodyLines = [];
      if (tasksWithFailedDependencies.length > 0) {
        bodyLines.push(
          output.colors.gray(
            'Tasks not run because their dependencies failed:'
          ),
          '',
          ...tasksWithFailedDependencies.map(
            (task) => `${output.colors.gray('-')} ${task.id}`
          ),
          ''
        );
      }
      bodyLines.push(
        output.colors.gray('Failed tasks:'),
        '',
        ...failedTasks.map((task) => `${output.colors.gray('-')} ${task.id}`)
      );
      if (!args.onlyFailed && !startedWithFailedProjects) {
        bodyLines.push(
          '',
          `${output.colors.gray(
            'You can isolate the above projects by passing:'
          )} ${output.bold('--only-failed')}`
        );
      }
      output.error({
        title: `Running target "${args.target}" failed`,
        bodyLines,
      });
    }
  }
}
