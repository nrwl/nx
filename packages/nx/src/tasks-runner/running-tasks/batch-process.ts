import type { ChildProcess, Serializable } from 'child_process';
import type { Readable } from 'stream';
import { createWriteStream, mkdirSync, rmSync, type WriteStream } from 'fs';
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
   * grouping. It is rendered as a fold by a full-output run and by any batch
   * that reported a failed or stopped task (alongside per-task rendering), and
   * by any batch that crashed or was stopped before reporting (with redirect
   * lines — no per-task blocks exist there), so that a diagnostic no task
   * claimed — a crash, a config-phase error, a runner's summary — is not lost.
   * Only a batch whose every task succeeded on the default style discards it
   * unread. Crashiness is unknowable while capturing, so it is always written.
   *
   * It goes to disk rather than a string because a batch is long-lived (Gradle
   * runs one for the whole command) and its output has no bound. Accumulating
   * that in memory grows without limit and eventually exceeds the maximum
   * length of a JS string.
   */
  private capturedOutputPath: string | undefined;
  private capturedOutputStream: WriteStream | undefined;
  /**
   * Set once the capture is released. A chunk can still arrive after that —
   * stdout delivers past the exit event — and writing then would reach a file
   * the renderer has already read.
   */
  private capturedOutputDiscarded = false;
  /**
   * Set when the capture file could not be written. Whatever reached it is kept
   * and still rendered: that is the head of the batch's log, where a compiler's
   * first non-cascading errors are.
   */
  private capturedOutputFailed = false;
  private static captureSeq = 0;
  /** Discriminates this capture file from every other in the process. */
  private readonly captureSeq = ++BatchProcess.captureSeq;

  constructor(
    private childProcess: ChildProcess,
    private executorName: string,
    /**
     * Whether the active output style puts task bytes on the terminal at all.
     * `summary` does not, and its life cycle cannot enforce that here: this
     * class writes to `output` directly from a stream handler, so without being
     * told it would print a whole batch into a run that asked for log paths.
     *
     * False makes this capture rather than print. Suppressing the write alone
     * would drop the bytes entirely off GitHub Actions, where nothing else
     * captures them - and the worker's own crash output is exactly what no task
     * ever claims, so it would exist nowhere.
     */
    private readonly printsOutput: boolean = true,
    /** Labels the capture file so it is identifiable in `batch-outputs/`. */
    private readonly batchId: string = executorName
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
        if (shouldGroupBatchOutput() || !this.printsOutput) {
          this.capture(chunk, this.childProcess.stdout);
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

        if (shouldGroupBatchOutput() || !this.printsOutput) {
          this.capture(chunk, this.childProcess.stderr);
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

  private capture(chunk: string | Buffer, source?: Readable | null) {
    // Stops on release or on a capture failure; otherwise a handed-over
    // capture keeps appending until the fold is rendered.
    if (this.capturedOutputDiscarded || this.capturedOutputFailed) {
      return;
    }
    const stream = this.openCapturedOutput();
    if (!stream) {
      return;
    }
    // A full write buffer pauses the worker rather than growing in this
    // process - which is the whole reason the capture is a file and not a
    // string.
    if (!stream.write(chunk) && source) {
      source.pause();
      stream.once('drain', () => source.resume());
    }
  }

  /**
   * The capture file, opened on the first chunk.
   */
  private openCapturedOutput(): WriteStream | undefined {
    if (this.capturedOutputStream) {
      return this.capturedOutputStream;
    }
    try {
      const dir = join(workspaceDataDirectory, 'batch-outputs');
      mkdirSync(dir, { recursive: true });
      // `batchId` names the file for a human reading the directory;
      // `captureSeq` is what makes it unique, since a second `TasksSchedule`
      // in the same process re-mints the same id and the pid cannot separate
      // them.
      const name = `${this.batchId.replace(/[^a-zA-Z0-9]+/g, '-')}-${
        process.pid
      }-${this.captureSeq}.log`;
      const path = join(dir, name);
      const stream = createWriteStream(path);
      // Mandatory, not defensive: a write error reaches a stream as an 'error'
      // event, and an unhandled one is an uncaught exception that would take
      // down a run with nothing else wrong with it. Stop capturing and keep
      // what already reached the file — that is the head of the batch's log,
      // where a compiler's first non-cascading errors are.
      stream.on('error', () => {
        this.capturedOutputFailed = true;
      });
      this.capturedOutputPath = path;
      this.capturedOutputStream = stream;
    } catch {
      // mkdir is the only synchronous throw here; the stream reports its own
      // failures through the handler above.
      this.capturedOutputFailed = true;
    }
    return this.capturedOutputStream;
  }

  /**
   * Flushes and closes the capture so the file is complete before a caller
   * reads it.
   */
  async flushCapturedOutput(): Promise<void> {
    const stream = this.capturedOutputStream;
    if (!stream || stream.destroyed || stream.writableEnded) {
      return;
    }
    await new Promise<void>((resolve) => stream.end(resolve));
  }

  /**
   * Path to the file holding everything held back from the live stream under
   * log grouping, or undefined if nothing was captured. Used to render the whole
   * batch as one fold, so output no task claimed is not lost.
   *
   * The stream is deliberately left open rather than closed here. A worker's
   * stdout can deliver after its exit event — which is what `getResults()`
   * settles on — and leaving it open keeps such a chunk appending to this same
   * file rather than opening a second one that nothing cleans up. Call
   * `flushCapturedOutput` before reading: the stream buffers, so a read that
   * has not been sequenced against the flush can see a short file.
   */
  getCapturedOutputPath(): string | undefined {
    return this.capturedOutputPath;
  }

  /** Releases the capture file. Safe to call more than once. */
  discardCapturedOutput(): void {
    this.capturedOutputDiscarded = true;
    this.releaseCapturedOutput();
  }

  /**
   * Destroys the stream and unlinks the file, leaving no path behind for a
   * caller to read. Tolerates a partially-initialized capture, since it also
   * runs when opening or writing the file is what failed.
   */
  private releaseCapturedOutput() {
    this.closeCapturedOutput();
    if (this.capturedOutputPath) {
      try {
        rmSync(this.capturedOutputPath, { force: true });
      } catch {
        // `force` covers a missing file but not a locked one: on Windows an fd
        // that failed to close still holds a share lock. This runs from
        // `runBatch`'s finally, where throwing would replace the batch's real
        // result with a cleanup error, so a stale file is the lesser outcome.
      }
      this.capturedOutputPath = undefined;
    }
  }

  /** Destroys the stream, dropping anything still buffered. The file stays. */
  private closeCapturedOutput() {
    if (this.capturedOutputStream) {
      this.capturedOutputStream.destroy();
      this.capturedOutputStream = undefined;
    }
  }

  // Resolves on the CompleteBatchExecution message, not process exit: the
  // child can outlive its results (open handles keep it alive), so callers
  // must not treat a settled batch as an exited process.
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
