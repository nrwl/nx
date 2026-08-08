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
  /**
   * All stdout/stderr held back from the live stream under log grouping. A
   * successful batch is rendered from its per-task terminalOutput and this is
   * discarded; a failed one is rendered from this as a single fold, so that a
   * diagnostic no task claimed — a crash, a config-phase error, a runner's
   * summary — is not lost. Tail-capped so a long-lived batch (Gradle runs one
   * for the whole command) cannot grow it without bound.
   */
  private capturedOutput = '';
  private static readonly CAPTURED_OUTPUT_CAP = 1_000_000;

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

        // When batch output is being folded, the live copy is suppressed to
        // keep each group contiguous; it is retained (see capturedOutput) so a
        // failed batch can still surface everything. Otherwise, maintain
        // current terminal output behavior.
        if (shouldGroupBatchOutput()) {
          this.capture(output);
        } else {
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
          this.capture(output);
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

  private capture(output: string) {
    this.capturedOutput += output;
    if (this.capturedOutput.length > BatchProcess.CAPTURED_OUTPUT_CAP) {
      this.capturedOutput = this.capturedOutput.slice(
        -BatchProcess.CAPTURED_OUTPUT_CAP
      );
    }
  }

  /**
   * All stdout/stderr held back from the live stream under log grouping. Empty
   * unless the batch was being grouped; used to render a failed batch as one
   * fold so output no task claimed is not lost. Tail-capped.
   */
  getCapturedOutput(): string {
    return this.capturedOutput;
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
