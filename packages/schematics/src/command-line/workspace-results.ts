import * as fs from 'fs';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import { unlinkSync } from 'fs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

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
    if (!resultsExists) {
      this.startedWithFailedProjects = false;
    } else {
      const commandResults = readJsonFile(RESULTS_FILE);
      this.startedWithFailedProjects = commandResults.command === command;

      if (this.startedWithFailedProjects) {
        this.commandResults = commandResults;
      }
    }
  }

  getResult(projectName: string): boolean {
    return this.commandResults.results[projectName];
  }

  fail(projectName: string) {
    this.setResult(projectName, false);
  }

  success(projectName: string) {
    this.setResult(projectName, true);
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
    const failedProjects = this.failedProjects;
    if (this.failedProjects.length === 0) {
      console.log(successMessage);
      if (onlyFailed && this.startedWithFailedProjects) {
        console.warn(stripIndents`
          Warning: Only failed affected projects were run.
          You should run above command WITHOUT --only-failed
        `);
      }
    } else {
      console.error(failureMessage);
      console.log(`Failed projects: ${failedProjects.join(',')}`);
      if (!onlyFailed && !this.startedWithFailedProjects) {
        console.log(
          `You can isolate the above projects by passing --only-failed`
        );
      }
    }
  }

  private setResult(projectName: string, result: boolean) {
    this.commandResults.results[projectName] = result;
  }
}
