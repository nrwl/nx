import { Task } from '@nrwl/devkit';
import { Reporter, ReporterArgs } from './reporter';

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
