import { output } from '../utils/output';

export interface ReporterArgs {
  target?: string;
  configuration?: string;
  onlyFailed?: boolean;
}

export class DefaultReporter {
  beforeRun(
    affectedProjectNames: string[],
    affectedArgs: ReporterArgs,
    taskOverrides: any
  ) {
    if (affectedProjectNames.length <= 0) {
      let description = `with "${affectedArgs.target}"`;
      if (affectedArgs.configuration) {
        description += ` that are configured for "${affectedArgs.configuration}"`;
      }
      output.logSingleLine(`No projects ${description} were run`);
      return;
    }

    const bodyLines = affectedProjectNames.map(
      affectedProject => `${output.colors.gray('-')} ${affectedProject}`
    );
    if (Object.keys(taskOverrides).length > 0) {
      bodyLines.push('');
      bodyLines.push(`${output.colors.gray('With flags:')}`);
      Object.entries(taskOverrides)
        .map(([flag, value]) => `  --${flag}=${value}`)
        .forEach(arg => bodyLines.push(arg));
    }

    output.log({
      title: `${output.colors.gray('Running target')} ${
        affectedArgs.target
      } ${output.colors.gray('for projects:')}`,
      bodyLines
    });

    output.addVerticalSeparator();
  }

  printResults(
    affectedArgs: ReporterArgs,
    failedProjectNames: string[],
    startedWithFailedProjects: boolean,
    cachedProjectNames: string[]
  ) {
    output.addNewline();
    output.addVerticalSeparator();

    if (failedProjectNames.length === 0) {
      output.success({
        title: `Running target "${affectedArgs.target}" succeeded`
      });

      if (affectedArgs.onlyFailed && startedWithFailedProjects) {
        output.warn({
          title: `Only projects ${output.underline(
            'which had previously failed'
          )} were run`,
          bodyLines: [
            `You should verify by running ${output.underline(
              'without'
            )} ${output.bold('--only-failed')}`
          ]
        });
      }
    } else {
      const bodyLines = [
        output.colors.gray('Failed projects:'),
        '',
        ...failedProjectNames.map(
          project => `${output.colors.gray('-')} ${project}`
        )
      ];
      if (!affectedArgs.onlyFailed && !startedWithFailedProjects) {
        bodyLines.push('');
        bodyLines.push(
          `${output.colors.gray(
            'You can isolate the above projects by passing:'
          )} ${output.bold('--only-failed')}`
        );
      }
      output.error({
        title: `Running target "${affectedArgs.target}" failed`,
        bodyLines
      });
    }

    if (cachedProjectNames.length > 0) {
      const bodyLines = cachedProjectNames.map(
        project => `${output.colors.gray('-')} ${project}`
      );
      output.note({
        title: `Nx read the output from cache instead of running the command for the following projects:`,
        bodyLines
      });
    }
  }
}
