import type { ChildProcess, Serializable } from 'child_process';
import { killProcessTreeGraceful } from '../../native';
import type { TaskResult } from '../../config/misc-interfaces';
import { signalToCode } from '../../utils/exit-codes';
import { shouldGroupBatchOutput } from '../../utils/output';
import {
  BatchMessage,
  BatchMessageType,
  BatchResults,
} from '../batch/batch-messages';

export class BatchProcess {
  private exitCallbacks: Array<(code: number) => void> = [];
  private batchResultsCallbacks: Array<(results: BatchResults) => void> = [];
  private taskResultsCallbacks: Array<
    (task: string, result: TaskResult) => void
  > = [];
  private outputCallbacks: Array<(output: string) => void> = [];
  /** stderr held back under log grouping, surfaced only if the batch crashes. */
  private capturedError = '';

  constructor(
    private childProcess: ChildProcess,
    private executorName: string
  ) {
    this.childProcess.on('message', (message: BatchMessage) => {
      switch (message.type) {
        case BatchMessageType.CompleteTask: {
          for (const cb of this.taskResultsCallbacks) {
            cb(message.task, message.result);
          }
          break;
        }
        case BatchMessageType.CompleteBatchExecution: {
          for (const cb of this.batchResultsCallbacks) {
            cb(message.results);
          }
          break;
        }
        case BatchMessageType.RunTasks: {
          break;
        }
        default: {
          // Re-emit any non-batch messages from the task process
          if (process.send) {
            process.send(message);
          }
        }
      }
    });

    this.childProcess.once('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);

      for (const cb of this.exitCallbacks) {
        cb(code);
      }
    });

    // Capture stdout output
    if (this.childProcess.stdout) {
      this.childProcess.stdout.on('data', (chunk) => {
        const output = chunk.toString();

        // The grouped per-task block is the canonical copy when batch output is
        // being folded, so the live copy is suppressed to keep the group
        // contiguous. Otherwise, maintain current terminal output behavior.
        if (!shouldGroupBatchOutput()) {
          process.stdout.write(chunk);
        }

        // Notify callbacks for TUI
        for (const cb of this.outputCallbacks) {
          cb(output);
        }
      });
    }

    // Capture stderr output
    if (this.childProcess.stderr) {
      this.childProcess.stderr.on('data', (chunk) => {
        const output = chunk.toString();

        if (shouldGroupBatchOutput()) {
          // Suppressed from the live stream like stdout, but retained: a
          // crashed worker reports its fatal only here (never over IPC) and
          // sends no per-task result, so without this the grouped block never
          // fires and the crash is silent. Flushed by the orchestrator if the
          // batch exits without results.
          this.capturedError += output;
        } else {
          // Maintain current terminal output behavior
          process.stderr.write(chunk);
        }

        // Notify callbacks for TUI
        for (const cb of this.outputCallbacks) {
          cb(output);
        }
      });
    }
  }

  onExit(cb: (code: number) => void) {
    this.exitCallbacks.push(cb);
  }

  onBatchResults(cb: (results: BatchResults) => void) {
    this.batchResultsCallbacks.push(cb);
  }

  onTaskResults(cb: (task: string, result: TaskResult) => void) {
    this.taskResultsCallbacks.push(cb);
  }

  onOutput(cb: (output: string) => void) {
    this.outputCallbacks.push(cb);
  }

  /**
   * stderr that was held back from the live stream under log grouping. Empty
   * unless the batch was being grouped; used to surface a crash whose output
   * would otherwise be swallowed.
   */
  getCapturedErrorOutput(): string {
    return this.capturedError;
  }

  async getResults(): Promise<BatchResults> {
    return Promise.race<BatchResults>([
      new Promise((_, rej) => {
        this.onExit((code) => {
          if (code !== 0) {
            rej(
              new Error(
                `"${this.executorName}" exited unexpectedly with code: ${code}`
              )
            );
          }
        });
      }),
      new Promise((res) => {
        this.onBatchResults(res);
      }),
    ]);
  }

  send(message: Serializable): void {
    if (this.childProcess.connected) {
      this.childProcess.send(message);
    }
  }

  kill(signal?: NodeJS.Signals): Promise<void> {
    if (this.childProcess?.pid) {
      return killProcessTreeGraceful(this.childProcess.pid, signal);
    }
    return Promise.resolve();
  }
}
