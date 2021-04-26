import { output } from '../utilities/output';
import { Reporter, ReporterArgs } from './reporter';
import { Task } from './tasks-runner';

export class RunOneReporter implements Reporter {
  private projectNames: string[];
  constructor(private readonly initiatingProject: string) {}

  beforeRun(
    projectNames: string[],
    tasks: Task[],
    args: ReporterArgs,
    taskOverrides: any
  ) {
    // Silent for a single task
    if (tasks.length === 1 && process.env.NX_INVOKED_BY_RUNNER) {
      return;
    }
    this.projectNames = projectNames;
    const numberOfDeps = tasks.length - 1;

    if (numberOfDeps > 0) {
      output.log({
        title: `${output.colors.gray('Running target')} ${
          args.target
        } ${output.colors.gray('for project')} ${
          this.initiatingProject
        } ${output.colors.gray(
          `and`
        )} ${numberOfDeps} task(s) ${output.colors.gray(`that it depends on.`)}
        `,
      });
      output.addVerticalSeparatorWithoutNewLines();
    }
  }

  printResults(
    args: ReporterArgs,
    failedProjectNames: string[],
    startedWithFailedProjects: boolean,
    tasks: Task[],
    failedTasks: Task[],
    cachedTasks: Task[]
  ) {
    // Silent for a single task
    if (tasks.length === 1 && process.env.NX_INVOKED_BY_RUNNER) {
      return;
    }
    output.addNewline();
    output.addVerticalSeparatorWithoutNewLines();

    if (failedProjectNames.length === 0) {
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
      const bodyLines = [
        output.colors.gray('Failed tasks:'),
        '',
        ...failedTasks.map((task) => `${output.colors.gray('-')} ${task.id}`),
      ];
      output.error({
        title: `Running target "${args.target}" failed`,
        bodyLines,
      });
    }
  }
}
