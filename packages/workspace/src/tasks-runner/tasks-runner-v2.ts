import {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
} from './default-tasks-runner';
import {
  Task,
  TaskStatus,
} from '@nrwl/workspace/src/tasks-runner/tasks-runner';
import { NxJsonConfiguration, ProjectGraph } from '@nrwl/devkit';
import { Subject } from 'rxjs/internal/Subject';
import type { Observable } from 'rxjs';

export { DefaultTasksRunnerOptions, RemoteCache } from './default-tasks-runner';

/**
 * This tasks runner converts the new implementation of the default tasks runner
 * to the old Observable-based API.
 *
 * It is going to be removed after Nx 15 is released.
 */
export const tasksRunnerV2 = (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    target: string;
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
  }
): Observable<any> => {
  const r = new Subject<any>();

  (defaultTasksRunner(tasks, options, context) as any)
    .then((tasks: { [id: string]: TaskStatus }) => {
      convertCompletedTasksToOutputFormat(tasks).forEach((k) => r.next(k));
      r.complete();
    })
    .catch((e) => {
      r.error(e);
      r.complete();
    });

  return r;
};

function convertCompletedTasksToOutputFormat(completedTasks: {
  [id: string]: TaskStatus;
}) {
  return Object.keys(completedTasks).map((taskId): any => {
    const taskStatus = completedTasks[taskId];
    return {
      success: taskStatus === 'success' || taskStatus === 'cache',
    };
  });
}
