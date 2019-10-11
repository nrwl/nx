import * as fs from 'fs';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import { unlinkSync } from 'fs';

const RESULTS_FILE = 'dist/.nx-results';

interface NxResults {
  command: string;
  results: { [key: string]: boolean };
}

export class WorkspaceResults {
  public startedWithFailedProjects: boolean;
  private commandResults: NxResults = {
    command: this.command,
    results: {}
  };

  get failedProjects() {
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

  setResult(projectName: string, result: boolean) {
    this.commandResults.results[projectName] = result;
  }
}
