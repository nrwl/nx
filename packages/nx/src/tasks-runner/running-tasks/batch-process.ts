import type { ChildProcess, Serializable } from 'child_process';
import type { Readable } from 'stream';
import { createWriteStream, mkdirSync, rmSync, type WriteStream } from 'fs';
import { randomBytes } from 'crypto';
import { dirname } from 'path';
import { killProcessTreeGraceful } from '../../native';
import type { TaskResult } from '../../config/misc-interfaces';
import { batchOutputPathForKey } from '../cache';
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
  /** Sources paused for backpressure, awaiting a 'drain' that may never come. */
  private readonly pausedSources = new Set<Readable>();
  /**
   * Set once the capture is released. A chunk can still arrive after that —
   * stdout delivers past the exit event — and writing then would reach a file
   * the renderer has already read.
   */
  private capturedOutputDiscarded = false;
  /**
   * Set when the capture file could not be written. Whatever reached it is kept
   * and still rendered: that is the head of the batch's log, where a compiler's
   * first non-cascading errors are. Everything after it goes to the terminal -
   * see `capture`.
   */
  private capturedOutputFailed = false;
  /** Set once the failure has been reported, so it is said once per batch. */
  private capturedOutputWarned = false;
  private static captureSeq = 0;
  /** Turns `flushCapturedOutput` waits for a resumed source to empty. */
  private static readonly MAX_DRAIN_TURNS = 100;
  /**
   * Makes the capture file unique across every batch in the process, which
   * `batchId` alone does not: `TasksSchedule.batchCounters` is per instance, so
   * a second orchestrator in the same process - `runDiscreteTasks` and
   * `runContinuousTasks`, not the CLI - re-mints `<executor> 1`, and the pid
   * cannot separate them.
   */
  private readonly captureSeq = ++BatchProcess.captureSeq;
  /**
   * Separates this capture from one minted by a DIFFERENT process, which
   * `captureSeq` cannot: it is a per-process static that restarts at 1. These
   * files now outlive their batch and `cacheDir` can be shared across checkouts
   * of a repo, so without this a recycled pid truncates a log an earlier run's
   * summary is still pointing at.
   */
  private readonly captureNonce = randomBytes(4).toString('hex');

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
    /** Labels the capture file so it is identifiable in `batchOutputs/`. */
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
    // A released capture drops the chunk. The renderer has already read the
    // file, so there is nothing left for these bytes to reach.
    if (this.capturedOutputDiscarded) {
      return;
    }
    // A failed one does not. The style withheld these bytes on the promise that
    // they are readable elsewhere; once the file is unwritable that promise
    // cannot be kept, so they go to the terminal even under a style that prints
    // nothing. Losing the format is survivable, losing task output is what this
    // path exists to prevent.
    if (this.capturedOutputFailed) {
      this.forwardUncaptured(chunk, source);
      return;
    }
    const stream = this.openCapturedOutput();
    if (!stream) {
      // Opening is what failed, so nothing of this chunk reached disk.
      this.forwardUncaptured(chunk, source);
      return;
    }
    // A full write buffer pauses the worker rather than growing in this
    // process. Tracked, because only 'drain' resumes it and a stream that
    // errors never emits one - see `resumeCapturedSources`.
    if (!stream.write(chunk) && source) {
      this.pausedSources.add(source);
      source.pause();
      stream.once('drain', () => {
        this.pausedSources.delete(source);
        source.resume();
      });
    }
  }

  /**
   * Puts bytes the capture could not take back on the terminal, on the stream
   * they arrived on.
   */
  private forwardUncaptured(chunk: string | Buffer, source?: Readable | null) {
    output.writeTaskOutputChunk(
      chunk,
      source === this.childProcess.stderr ? process.stderr : process.stdout
    );
  }

  /**
   * Names the failure once. A stream reports it asynchronously, so the chunk
   * that tripped it may or may not have reached disk - unlike a `writeSync`,
   * there is no byte count to tell. Every chunk after it is forwarded.
   */
  private warnCaptureFailed(reason: string) {
    if (this.capturedOutputWarned) {
      return;
    }
    this.capturedOutputWarned = true;
    output.warn({
      title: `Could not capture batch output for ${this.executorName}`,
      bodyLines: [reason, 'Streaming the rest of it live instead.'],
    });
  }

  /**
   * Lets the worker write again after the capture has stopped.
   *
   * Without this a failed capture wedges the whole run: the source stays
   * paused, so the worker blocks once its stdout pipe fills, never sends its
   * results, and `getResults` waits on a batch that can no longer finish.
   */
  private resumeCapturedSources(): Readable[] {
    const resumed = [...this.pausedSources];
    for (const source of resumed) {
      source.resume();
    }
    this.pausedSources.clear();
    return resumed;
  }

  private openCapturedOutput(): WriteStream | undefined {
    if (this.capturedOutputStream) {
      return this.capturedOutputStream;
    }
    try {
      // `batchId` names the file for a human reading the directory;
      // `captureSeq` separates batches within this process and `captureNonce`
      // separates it from every other process - see both fields.
      const key = `${this.batchId.replace(/[^a-zA-Z0-9]+/g, '-')}-${
        process.pid
      }-${this.captureSeq}-${this.captureNonce}`;
      const path = batchOutputPathForKey(key);
      mkdirSync(dirname(path), { recursive: true });
      const stream = createWriteStream(path);
      // Mandatory, not defensive: a write error reaches a stream as an 'error'
      // event, and an unhandled one is an uncaught exception that would take
      // down a run with nothing else wrong with it. Stop capturing, keep what
      // already reached the file — the head of the batch's log, where a
      // compiler's first non-cascading errors are — and put everything after
      // it on the terminal.
      stream.on('error', (e) => {
        this.capturedOutputFailed = true;
        this.resumeCapturedSources();
        this.warnCaptureFailed(e.message);
      });
      this.capturedOutputPath = path;
      this.capturedOutputStream = stream;
    } catch (e) {
      // mkdir is the only synchronous throw here; the stream reports its own
      // failures through the handler above.
      this.capturedOutputFailed = true;
      this.warnCaptureFailed(e.message);
    }
    return this.capturedOutputStream;
  }

  /**
   * Flushes and closes the capture so the file is complete before a caller
   * reads it.
   */
  async flushCapturedOutput(): Promise<void> {
    // Before the early return, and unconditionally: `end()` means a pending
    // 'drain' will never arrive, so a source paused for backpressure has
    // nothing left to resume it. Measured: 20/20 runs reach 'finish' with the
    // source still paused.
    const resumed = this.resumeCapturedSources();
    // `resume()` delivers on the next tick while `end()` takes effect in this
    // one, so ending here would strand everything the source still holds - the
    // tail of the log, which is where a build tool puts what went wrong.
    // Bounded, because a source that never empties must not hold the run open.
    for (
      let turn = 0;
      turn < BatchProcess.MAX_DRAIN_TURNS &&
      resumed.some((source) => source.readableLength > 0);
      turn++
    ) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
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
   * Not valid to read before `flushCapturedOutput`; that flush ends the stream,
   * so a chunk arriving afterwards - a worker's stdout can deliver past the
   * exit event `getResults()` settles on - is dropped rather than appended.
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
    this.resumeCapturedSources();
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
