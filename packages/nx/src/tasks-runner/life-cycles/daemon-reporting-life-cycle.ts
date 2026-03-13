import { parse } from 'path';
import { Task } from '../../config/task-graph';
import { TaskStatus as NativeTaskStatus } from '../../native';
import { type DaemonClient } from '../../daemon/client/client';
import type { RunningTaskStatusUpdate } from '../../daemon/message-types/running-tasks';
import { LifeCycle, TaskResult } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';

const OUTPUT_FLUSH_INTERVAL_MS = 2000;

function nativeStatusToString(status: NativeTaskStatus): string {
  switch (status) {
    case NativeTaskStatus.Success:
      return 'success';
    case NativeTaskStatus.Failure:
      return 'failure';
    case NativeTaskStatus.Skipped:
      return 'skipped';
    case NativeTaskStatus.LocalCacheKeptExisting:
      return 'local-cache-kept-existing';
    case NativeTaskStatus.LocalCache:
      return 'local-cache';
    case NativeTaskStatus.RemoteCache:
      return 'remote-cache';
    case NativeTaskStatus.InProgress:
      return 'in-progress';
    case NativeTaskStatus.NotStarted:
      return 'not-started';
    case NativeTaskStatus.Stopped:
      return 'stopped';
    default:
      return 'unknown';
  }
}

function parseCommand(): string {
  const cmdBase = parse(process.argv[1]).name;
  const args = process.argv.slice(2).join(' ');
  return `${cmdBase} ${args}`;
}

export class DaemonReportingLifeCycle implements LifeCycle {
  private pendingOutputChunks: Record<string, string> = {};
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pid = process.pid;

  constructor(
    private readonly daemonClient: DaemonClient,
    private readonly command: string = parseCommand()
  ) {}

  private isEnabled(): boolean {
    return this.daemonClient.enabled();
  }

  private send(fn: () => Promise<void>): void {
    if (!this.isEnabled()) return;
    fn().catch(() => {
      // Fire-and-forget: daemon errors must never block task execution
    });
  }

  startCommand(): void {
    this.send(() =>
      this.daemonClient.registerRunningTasks(this.pid, this.command, [])
    );
    this.flushTimer = setInterval(
      () => this.flushOutput(),
      OUTPUT_FLUSH_INTERVAL_MS
    );
  }

  startTasks(tasks: Task[]): void {
    const updates: RunningTaskStatusUpdate[] = tasks.map((t) => ({
      id: t.id,
      status: 'in-progress',
      continuous: !!t.continuous,
      startTime: new Date().toISOString(),
    }));
    this.send(() =>
      this.daemonClient.updateRunningTasks(this.pid, updates, {})
    );
  }

  setTaskStatus(taskId: string, status: NativeTaskStatus): void {
    const updates: RunningTaskStatusUpdate[] = [
      { id: taskId, status: nativeStatusToString(status) },
    ];
    this.send(() =>
      this.daemonClient.updateRunningTasks(this.pid, updates, {})
    );
  }

  endTasks(taskResults: TaskResult[]): void {
    const updates: RunningTaskStatusUpdate[] = taskResults.map((tr) => ({
      id: tr.task.id,
      status: tr.status as string,
      endTime: new Date().toISOString(),
    }));
    this.send(() =>
      this.daemonClient.updateRunningTasks(this.pid, updates, {})
    );
  }

  appendTaskOutput(taskId: string, output: string): void {
    if (!this.isEnabled()) return;
    this.pendingOutputChunks[taskId] =
      (this.pendingOutputChunks[taskId] ?? '') + output;
  }

  endCommand(): void {
    this.flushOutput();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.send(() => this.daemonClient.unregisterRunningTasks(this.pid));
  }

  private flushOutput(): void {
    const chunks = this.pendingOutputChunks;
    if (Object.keys(chunks).length === 0) return;
    this.pendingOutputChunks = {};
    this.send(() => this.daemonClient.updateRunningTasks(this.pid, [], chunks));
  }
}
