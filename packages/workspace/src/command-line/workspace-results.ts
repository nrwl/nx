import * as fs from 'fs';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import { unlinkSync } from 'fs';
import { output } from './output';

const RESULTS_FILE = 'dist/.nx-results';

interface NxResults {
  command: string;
  results: { [key: string]: boolean };
}

export class WorkspaceResults {
  private startedWithFailedProjects: boolean;
  private commandResults: NxResults = {
    command: this.command,
    results: {}
  };

  private get failedProjects() {
    return Object.entries(this.commandResults.results)
      .filter(([_, result]) => !result)
      .map(([project]) => project);
  }

  public get hasFailure() {
    return Object.values(this.commandResults.results).some(result => !result);
  }

  constructor(private command: string) {
    const resultsExists = fs.existsSync(RESULTS_FILE);
    this.startedWithFailedProjects = false;
    if (resultsExists) {
      try {
        const commandResults = readJsonFile(RESULTS_FILE);
        this.startedWithFailedProjects = commandResults.command === command;
        if (this.startedWithFailedProjects) {
          this.commandResults = commandResults;
        }
      } catch {
        /**
         * If we got here it is likely that RESULTS_FILE is not valid JSON.
         * It is safe to continue, and it does not make much sense to give the
         * user feedback as the file will be updated automatically.
         */
      }
    }
  }

  getResult(projectName: string): boolean {
    return this.commandResults.results[projectName];
  }

  saveResults() {
    if (Object.values<boolean>(this.commandResults.results).includes(false)) {
      writeJsonFile(RESULTS_FILE, this.commandResults);
    } else if (fs.existsSync(RESULTS_FILE)) {
      unlinkSync(RESULTS_FILE);
    }
  }

  printResults(
    onlyFailed: boolean,
    successMessage: string,
    failureMessage: string
  ) {
    /**
     * Leave a bit of breathing room between the process output
     * and our formatted results.
     */
    output.addNewline();
    output.addVerticalSeparator();

    if (this.failedProjects.length === 0) {
      output.success({
        title: successMessage
      });

      if (onlyFailed && this.startedWithFailedProjects) {
        output.warn({
          title: `Only affected projects ${output.underline(
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
      ...this.failedProjects.map(
        project => `${output.colors.gray('-')} ${project}`
      )
    ];
    if (!onlyFailed && !this.startedWithFailedProjects) {
      bodyLines.push('');
      bodyLines.push(
        `${output.colors.gray(
          'You can isolate the above projects by passing:'
        )} ${output.bold('--only-failed')}`
      );
    }
    output.error({
      title: failureMessage,
      bodyLines
    });
  }

  setResult(projectName: string, result: boolean) {
    this.commandResults.results[projectName] = result;
  }
}
