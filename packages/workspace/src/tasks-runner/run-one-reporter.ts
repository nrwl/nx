import { output } from '../utilities/output';

export interface ReporterArgs {
  target?: string;
  configuration?: string;
  onlyFailed?: boolean;
}

export class RunOneReporter {
  private projectNames: string[];
  constructor(private readonly initiatingProject: string) {}

  beforeRun(projectNames: string[], args: ReporterArgs, taskOverrides: any) {
    this.projectNames = projectNames;
    const numberOfDeps = projectNames.length - 1;

    if (numberOfDeps > 0) {
      output.log({
        title: `${output.colors.gray('Running target')} ${
          args.target
        } ${output.colors.gray('for project')} ${
          this.initiatingProject
        } ${output.colors.gray(`and its ${numberOfDeps} deps.`)}`,
      });
      output.addVerticalSeparatorWithoutNewLines();
    }
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
      output.error({
        title: `Running target "${args.target}" failed`,
        bodyLines,
      });
    }
  }
}
