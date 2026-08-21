import type { ChildProcess, Serializable } from 'child_process';
import { closeSync, mkdirSync, openSync, rmSync, writeSync } from 'fs';
import { join } from 'path';
import { killProcessTreeGraceful } from '../../native';
import type { TaskResult } from '../../config/misc-interfaces';
import { workspaceDataDirectory } from '../../utils/cache-directory';
import { signalToCode } from '../../utils/exit-codes';
import { output, shouldGroupBatchOutput } from '../../utils/output';
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
   * File holding all stdout/stderr held back from the live stream under log
   * grouping. It is rendered as a single fold by a full-output run, and by any
   * batch that crashed or was stopped, so that a diagnostic no task claimed — a
   * crash, a config-phase error, a runner's summary — is not lost. A batch that
   * reported results on the default style renders per task and this is
   * discarded. Crashiness is unknowable while capturing, so it is always
   * written.
   *
   * It goes to disk rather than a string because a batch is long-lived (Gradle
   * runs one for the whole command) and its output has no bound. Accumulating
   * that in memory grows without limit and eventually exceeds the maximum
   * length of a JS string.
   */
  private capturedOutputPath: string | undefined;
  private capturedOutputFd: number | undefined;
  /**
   * Set once the capture is released. A chunk can still arrive after that —
   * stdout delivers past the exit event — and reopening then would mint a
   * second numbered file that nothing ever cleans up.
   */
  private capturedOutputDiscarded = false;
  private static capturedOutputCount = 0;

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
        const text = chunk.toString();

        // When batch output is being folded, the live copy is suppressed to
        // keep each group contiguous; it is retained (see capturedOutputPath)
        // for the renderings that need it. Otherwise, maintain
        // current terminal output behavior. These chunks are forwarded raw and
        // routinely end mid-line, so they go through `output` to keep its line
        // tracking accurate for whatever prints next.
        if (shouldGroupBatchOutput()) {
          this.capture(chunk);
        } else {
          output.writeTaskOutputChunk(chunk);
        }

        // Notify callbacks for TUI
        for (const cb of this.outputCallbacks) {
          cb(text);
        }
      });
    }

    // Capture stderr output
    if (this.childProcess.stderr) {
      this.childProcess.stderr.on('data', (chunk) => {
        const text = chunk.toString();

        if (shouldGroupBatchOutput()) {
          this.capture(chunk);
        } else {
          // Maintain current terminal output behavior
          output.writeTaskOutputChunk(chunk, process.stderr);
        }

        // Notify callbacks for TUI
        for (const cb of this.outputCallbacks) {
          cb(text);
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

  private capture(chunk: string | Buffer) {
    // Only a released capture stops recording; a handed-over one keeps
    // appending, so trailing output still reaches the fold.
    if (this.capturedOutputDiscarded) {
      return;
    }
    if (this.capturedOutputFd === undefined) {
      const dir = join(workspaceDataDirectory, 'batch-outputs');
      mkdirSync(dir, { recursive: true });
      const name = `${this.executorName.replace(/[^a-zA-Z0-9]+/g, '-')}-${
        process.pid
      }-${++BatchProcess.capturedOutputCount}.log`;
      this.capturedOutputPath = join(dir, name);
      this.capturedOutputFd = openSync(this.capturedOutputPath, 'w');
    }
    // Written synchronously so the file is complete the moment the batch ends,
    // with no flush to sequence against the read that renders the fold.
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    let written = 0;
    while (written < bytes.length) {
      written += writeSync(this.capturedOutputFd, bytes, written);
    }
  }

  /**
   * Path to the file holding everything held back from the live stream under
   * log grouping, or undefined if nothing was captured. Used to render the whole
   * batch as one fold, so output no task claimed is not lost.
   *
   * The file is deliberately left open. A worker's stdout can deliver after its
   * exit event — which is what `getResults()` settles on — and that trailing
   * output is exactly the kind this fold exists to carry, so it keeps appending
   * to the same file rather than being dropped or landing in a second one.
   * Writes are unbuffered, so a reader always sees a complete prefix.
   */
  getCapturedOutputPath(): string | undefined {
    return this.capturedOutputPath;
  }

  /** Releases the capture file. Safe to call more than once. */
  discardCapturedOutput(): void {
    this.capturedOutputDiscarded = true;
    this.closeCapturedOutput();
    if (this.capturedOutputPath) {
      rmSync(this.capturedOutputPath, { force: true });
      this.capturedOutputPath = undefined;
    }
  }

  private closeCapturedOutput() {
    if (this.capturedOutputFd !== undefined) {
      closeSync(this.capturedOutputFd);
      this.capturedOutputFd = undefined;
    }
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
