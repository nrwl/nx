import { output } from '../output';

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
      output.logSingleLine(`No projects ${description} were affected`);
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
    startedWithFailedProjects: boolean
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
      return;
    }

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
}
