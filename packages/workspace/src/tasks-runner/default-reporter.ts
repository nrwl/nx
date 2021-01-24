import { output } from '../utilities/output';

export interface ReporterArgs {
  target?: string;
  configuration?: string;
  onlyFailed?: boolean;
}

export class DefaultReporter {
  private projectNames: string[];

  beforeRun(projectNames: string[], args: ReporterArgs, taskOverrides: any) {
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

    output.log({
      title: `${output.colors.gray('Running target')} ${
        args.target
      } ${output.colors.gray('for projects:')}`,
      bodyLines,
    });

    output.addVerticalSeparatorWithoutNewLines();
  }

  printResults(
    args: ReporterArgs,
    failedProjectNames: string[],
    startedWithFailedProjects: boolean,
    cachedProjectNames: string[]
  ) {
    output.addNewline();
    output.addVerticalSeparatorWithoutNewLines();

    if (failedProjectNames.length === 0) {
      const bodyLines =
        cachedProjectNames.length > 0
          ? [
              output.colors.gray(
                `Nx read the output from cache instead of running the command for ${cachedProjectNames.length} out of ${this.projectNames.length} projects.`
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
        output.colors.gray('Failed projects:'),
        '',
        ...failedProjectNames.map(
          (project) => `${output.colors.gray('-')} ${project}`
        ),
      ];
      if (!args.onlyFailed && !startedWithFailedProjects) {
        bodyLines.push('');
        bodyLines.push(
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
