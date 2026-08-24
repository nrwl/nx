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
  private capturedOutputFd: number | undefined;
  /**
   * Set once the capture is released. A chunk can still arrive after that —
   * stdout delivers past the exit event — and reopening then would mint a
   * second numbered file that nothing ever cleans up.
   */
  private capturedOutputDiscarded = false;
  /**
   * Set when writing the capture failed. Distinct from discarded: the bytes
   * already on disk are still the best record of the batch, so the file is kept
   * and rendered, while everything after the failure goes live to the terminal.
   */
  private capturedOutputFailed = false;
  private static capturedOutputCount = 0;

  constructor(
    private childProcess: ChildProcess,
    private executorName: string,
    /**
     * Whether the active output style puts task bytes on the terminal at all.
     * `summary` does not, and its life cycle cannot enforce that here: this
     * class writes to `output` directly from a stream handler, so without being
     * told it would print a whole batch into a run that asked for log paths.
     */
    private readonly printsOutput: boolean = true
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
        } else if (this.printsOutput) {
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
          this.capture(chunk, process.stderr);
        } else if (this.printsOutput) {
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

  private capture(
    chunk: string | Buffer,
    stream: NodeJS.WriteStream = process.stdout
  ) {
    // Only a released capture stops recording; a handed-over one keeps
    // appending until the fold is rendered.
    if (this.capturedOutputDiscarded) {
      return;
    }
    if (this.capturedOutputFailed) {
      // Capture is over, but the output is not optional. Everything from here
      // goes straight to the terminal, on the stream it arrived on.
      output.writeTaskOutputChunk(chunk, stream);
      return;
    }
    // Hoisted so the catch can tell how much of this chunk reached the file: a
    // `writeSync` that fails partway leaves a prefix on disk, and replaying the
    // whole chunk live would print that prefix twice - once now, once when the
    // fold reads the file.
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    let written = 0;
    try {
      if (this.capturedOutputFd === undefined) {
        const dir = join(workspaceDataDirectory, 'batch-outputs');
        mkdirSync(dir, { recursive: true });
        const name = `${this.executorName.replace(/[^a-zA-Z0-9]+/g, '-')}-${
          process.pid
        }-${++BatchProcess.capturedOutputCount}.log`;
        const path = join(dir, name);
        // Assigned only once the file is actually open, so a path always names
        // an fd rather than a file that failed to open.
        const fd = openSync(path, 'w');
        this.capturedOutputPath = path;
        this.capturedOutputFd = fd;
      }
      // Written synchronously so the file is complete the moment the batch ends,
      // with no flush to sequence against the read that renders the fold.
      while (written < bytes.length) {
        written += writeSync(this.capturedOutputFd, bytes, written);
      }
    } catch (e) {
      // This runs inside a stream 'data' handler, where a throw is an uncaught
      // exception rather than something the orchestrator's try can see - so a
      // full disk or a read-only data directory would take down a run that
      // otherwise had nothing wrong with it. The capture is an optimization
      // that the common path discards anyway, so give it up and put the bytes
      // back on the terminal instead of losing both them and the run.
      // Latch on a flag of its own rather than reusing the discard flag: that
      // one makes `capture` return early, which would drop every later chunk
      // on the floor - captured nowhere and printed nowhere.
      this.capturedOutputFailed = true;
      // Close the fd but keep the file. Whatever was written before the failure
      // is still the head of the batch's log, which is where a compiler's first
      // non-cascading errors live; unlinking it here would throw away the most
      // useful bytes precisely when the disk is in trouble.
      this.closeCapturedOutput();
      // Forward only what did not reach the file, and do it before warning.
      // `output.warn` writes to the terminal as well, so if that is the thing
      // failing, the bytes this handler was handed must already be out - losing
      // the warning is survivable, losing task output is what this path exists
      // to prevent.
      const unwritten = bytes.subarray(written);
      if (unwritten.length > 0 && this.printsOutput) {
        output.writeTaskOutputChunk(unwritten, stream);
      }
      output.warn({
        title: `Could not capture batch output for ${this.executorName}`,
        bodyLines: [
          e.message,
          'Streaming the rest of it live instead; the fold holds what was captured first.',
        ],
      });
    }
  }

  /**
   * Path to the file holding everything held back from the live stream under
   * log grouping, or undefined if nothing was captured. Used to render the whole
   * batch as one fold, so output no task claimed is not lost.
   *
   * The file is deliberately left open rather than closed here. A worker's
   * stdout can deliver after its exit event — which is what `getResults()`
   * settles on — and leaving the fd open keeps such a chunk appending to this
   * same file instead of minting a second numbered one that nothing cleans up.
   * The caller reads the file once, synchronously, while rendering the fold, so
   * anything arriving after that read is not shown; writes are unbuffered, so
   * the read always sees a complete prefix of what has arrived by then.
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
   * Closes the fd and unlinks the file, leaving no path behind for a caller to
   * read. Tolerates a partially-initialized capture, since it also runs when
   * opening or writing the file is what failed.
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

  /** Closes the fd, keeping the file and its path readable. */
  private closeCapturedOutput() {
    if (this.capturedOutputFd !== undefined) {
      try {
        closeSync(this.capturedOutputFd);
      } catch {}
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
