import { Task } from '@nrwl/devkit';

export interface ReporterArgs {
  target?: string;
  configuration?: string;
  onlyFailed?: boolean;
}

/**
 * @deprecated the reporter API is no longer supported.
 * The class will be removed after Nx 14 is released.
 */
export abstract class Reporter {
  abstract beforeRun(
    projectNames: string[],
    tasks: Task[],
    args: ReporterArgs,
    taskOverrides: any
  ): void;

  abstract printResults(
    nxArgs: ReporterArgs,
    startedWithFailedProjects: boolean,
    tasks: Task[],
    failedTasks: Task[],
    tasksWithFailedDependencies: Task[],
    cachedTasks: Task[]
  ): void;
}
