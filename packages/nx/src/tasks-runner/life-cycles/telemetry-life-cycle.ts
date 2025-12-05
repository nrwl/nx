import { Task } from '../../config/task-graph';
import { recordTaskExecution } from '../../utils/telemetry';
import { LifeCycle, TaskResult } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';

/**
 * LifeCycle implementation that records task execution telemetry.
 *
 * Records anonymized task metrics including:
 * - Project name (anonymized)
 * - Target name (standard targets only, custom targets are marked as '[custom]')
 * - Duration
 * - Success/failure status
 * - Cache hit/miss status
 */
export class TelemetryLifeCycle implements LifeCycle {
  private startTimings: Record<string, number> = {};

  startTasks(tasks: Task[]): void {
    for (const task of tasks) {
      this.startTimings[task.id] = Date.now();
    }
  }

  endTasks(taskResults: TaskResult[]): void {
    for (const result of taskResults) {
      // Skip continuous tasks (serve, watch, etc.) - they don't have meaningful duration
      if (result.task.continuous) {
        continue;
      }

      const startTime =
        result.task.startTime ?? this.startTimings[result.task.id];
      const endTime = result.task.endTime ?? Date.now();
      const durationMs = startTime ? endTime - startTime : 0;

      recordTaskExecution({
        project: result.task.target.project,
        target: result.task.target.target,
        durationMs,
        status: this.mapStatus(result.status),
        cacheStatus: this.mapCacheStatus(result.status),
      });
    }
  }

  /**
   * Maps TaskStatus to telemetry status.
   */
  private mapStatus(
    status: TaskStatus
  ): 'success' | 'failure' | 'skipped' {
    switch (status) {
      case 'success':
      case 'local-cache':
      case 'local-cache-kept-existing':
      case 'remote-cache':
        return 'success';
      case 'failure':
        return 'failure';
      case 'skipped':
        return 'skipped';
      default:
        return 'failure';
    }
  }

  /**
   * Maps TaskStatus to cache status.
   */
  private mapCacheStatus(
    status: TaskStatus
  ): 'local-hit' | 'remote-hit' | 'miss' | 'disabled' {
    switch (status) {
      case 'local-cache':
      case 'local-cache-kept-existing':
        return 'local-hit';
      case 'remote-cache':
        return 'remote-hit';
      case 'success':
      case 'failure':
      case 'skipped':
      default:
        // If task ran to completion (success/failure) or was skipped,
        // it wasn't served from cache
        return 'miss';
    }
  }
}
