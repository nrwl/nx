import { performance } from 'perf_hooks';

import { customDimensions } from '../../analytics';
import type { LifeCycle, TaskResult, TaskMetadata } from '../life-cycle';

export class TaskTelemetryLifeCycle implements LifeCycle {
  private taskCount = 0;
  private cachedTaskCount = 0;
  private projects = new Set<string>();

  startCommand(): void {
    performance.mark('task-execution-lifecycle:start');
  }

  endTasks(taskResults: TaskResult[], metadata: TaskMetadata): void {
    for (const r of taskResults) {
      this.taskCount++;
      this.projects.add(r.task.target.project);
      if (
        r.status === 'local-cache' ||
        r.status === 'local-cache-kept-existing' ||
        r.status === 'remote-cache'
      ) {
        this.cachedTaskCount++;
      }
    }
  }

  endCommand(): void {
    performance.mark('task-execution-lifecycle:end');
    performance.measure('task-execution', {
      start: 'task-execution-lifecycle:start',
      end: 'task-execution-lifecycle:end',
      detail: {
        track: true,
        [customDimensions?.taskCount]: this.taskCount,
        [customDimensions?.cachedTaskCount]: this.cachedTaskCount,
        [customDimensions?.projectCount]: this.projects.size,
      },
    });
  }
}
