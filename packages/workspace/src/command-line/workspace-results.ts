import { readJsonFile, writeJsonFile } from '../utilities/fileutils';
import { existsSync, unlinkSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import type { ProjectGraphNode } from '@nrwl/devkit';
import { join } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import {
  cacheDirectory,
  readCacheDirectoryProperty,
} from '../utilities/cache-directory';

const resultsDir = cacheDirectory(
  appRootPath,
  readCacheDirectoryProperty(appRootPath)
);
const resultsFile = join(resultsDir, 'results.json');

interface NxResults {
  command: string;
  results: { [key: string]: boolean };
}

export class WorkspaceResults {
  public startedWithFailedProjects: boolean;
  private commandResults: NxResults = {
    command: this.command,
    results: {},
  };

  public get hasFailure() {
    return Object.values(this.commandResults.results).some((result) => !result);
  }

  constructor(
    private command: string,
    private projects: Record<string, ProjectGraphNode>
  ) {
    this.startedWithFailedProjects = false;
    if (existsSync(resultsFile)) {
      try {
        const commandResults = readJsonFile(resultsFile);
        this.startedWithFailedProjects = commandResults.command === command;
        if (this.startedWithFailedProjects) {
          this.commandResults = commandResults;
          this.invalidateOldResults();
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
    ensureDirSync(resultsDir);
    if (this.hasFailure) {
      writeJsonFile(resultsFile, this.commandResults);
    } else if (existsSync(resultsFile)) {
      unlinkSync(resultsFile);
    }
  }

  setResult(projectName: string, result: boolean) {
    this.commandResults.results[projectName] = result;
  }

  private invalidateOldResults() {
    Object.keys(this.commandResults.results).forEach((projectName) => {
      if (!this.projects[projectName]) {
        delete this.commandResults.results[projectName];
      }
    });
  }
}
