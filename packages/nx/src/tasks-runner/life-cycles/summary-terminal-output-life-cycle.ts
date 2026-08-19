import { Task } from '../../config/task-graph';
import { output } from '../../utils/output';
import { terminalOutputPathForHash } from '../cache';
import type { LifeCycle, TaskResult } from '../life-cycle';

/**
 * Prints a run as a handful of lines rather than a transcript: counts, then one
 * line per failure naming the file that holds its output. Task output stops
 * being a stream to read and becomes an artifact to address, so the size of this
 * renderer's output depends on how many tasks failed, never on how loud they
 * were.
 *
 * Selected by `--output-style=summary`, and by default when Nx is driven by an
 * AI agent, which otherwise reads thousands of lines of passing output to find
 * the one failure.
 */
export class SummaryTerminalOutputLifeCycle implements LifeCycle {
  private readonly failed: { task: Task; code: number }[] = [];
  private readonly stopped: Task[] = [];
  private readonly completed = new Set<string>();
  private succeeded = 0;
  private cached = 0;
  private cloudLink: { label: string; url: string } | undefined;

  constructor(private readonly tasks: Task[]) {}

  setCloudLink(label: string, url: string): void {
    this.cloudLink = { label, url };
  }

  /**
   * Nothing is printed as tasks complete. A summary that interleaved with
   * progress would be a transcript again.
   */
  printTaskTerminalOutput(): void {}

  endTasks(taskResults: TaskResult[]): void {
    for (const { task, status, code } of taskResults) {
      this.completed.add(task.id);
      switch (status) {
        case 'failure':
          this.failed.push({ task, code });
          break;
        case 'stopped':
          this.stopped.push(task);
          break;
        case 'local-cache':
        case 'local-cache-kept-existing':
        case 'remote-cache':
          this.cached++;
          this.succeeded++;
          break;
        default:
          this.succeeded++;
      }
    }
  }

  endCommand(): void {
    const skipped = this.tasks.filter((t) => !this.completed.has(t.id)).length;
    const bodyLines: string[] = [];

    for (const { task, code } of this.failed) {
      bodyLines.push('', ...this.failureBlock(task, code));
    }
    if (this.stopped.length > 0) {
      bodyLines.push(
        '',
        output.dim('Stopped before finishing:'),
        ...this.stopped.map((t) => `${output.dim('-')} ${t.id}`)
      );
    }
    if (this.cloudLink) {
      bodyLines.push('', `${this.cloudLink.label} ${this.cloudLink.url}`);
    }
    bodyLines.push(
      '',
      output.dim('Re-run with --output-style=static to inline logs.')
    );

    const title = this.countsLine(skipped);
    if (this.failed.length > 0 || this.stopped.length > 0) {
      output.error({ title, bodyLines });
    } else {
      output.success({ title, bodyLines });
    }
  }

  private countsLine(skipped: number): string {
    const parts = [`${this.succeeded} succeeded`];
    if (this.cached > 0) {
      parts.push(`${this.cached} cached`);
    }
    if (this.failed.length > 0) {
      parts.push(`${this.failed.length} failed`);
    }
    if (this.stopped.length > 0) {
      parts.push(`${this.stopped.length} stopped`);
    }
    if (skipped > 0) {
      parts.push(`${skipped} skipped`);
    }
    return `${this.tasks.length} ${
      this.tasks.length === 1 ? 'task' : 'tasks'
    }: ${parts.join(', ')}`;
  }

  private failureBlock(task: Task, code: number): string[] {
    // formatCommand is what every other renderer uses, so a task reads the same
    // here as it does under --output-style=static.
    const lines = [
      `${output.colors.red('✖')} ${output.formatCommand(task.id)}  ${output.dim(
        `(exit ${code})`
      )}`,
    ];

    // The log is addressed, not reproduced. `hash` is optional on the type but
    // always set by the time a task has run — processTask hashes before it
    // schedules — so this only guards against printing a bogus path.
    if (task.hash) {
      lines.push(
        output.dim(`  full log: ${terminalOutputPathForHash(task.hash)}`)
      );
    }
    return lines;
  }
}
