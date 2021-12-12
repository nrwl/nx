import { Task } from '@nrwl/devkit';
import { Reporter, ReporterArgs } from './reporter';

/**
 * @deprecated the reporter API is no longer supported
 * The class will be removed after Nx 14 is released.
 */
export class EmptyReporter implements Reporter {
  beforeRun(
    projectNames: string[],
    tasks: Task[],
    args: ReporterArgs,
    taskOverrides: any
  ) {}

  printResults(
    args: ReporterArgs,
    startedWithFailedProjects: boolean,
    tasks: Task[],
    failedTasks: Task[],
    tasksWithFailedDependencies: Task[],
    cachedTasks: Task[]
  ) {}
}
