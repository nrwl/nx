import * as pc from 'picocolors';
import type { ChildProcess, Serializable } from 'child_process';
import { readFileSync } from 'fs';
import { Transform } from 'stream';
import { killProcessTreeGraceful } from '../../native';
import { signalToCode } from '../../utils/exit-codes';
import { addPrefixTransformer, getColor } from './output-prefix';
import type { RunningTask } from './running-task';

export class NodeChildProcessWithNonDirectOutput implements RunningTask {
  private terminalOutputChunks: string[] = [];
  private joinedTerminalOutput: string | undefined;
  private exitCallbacks: Array<(code: number, terminalOutput: string) => void> =
    [];
  private outputCallbacks: Array<(output: string) => void> = [];

  private exitCode: number | undefined;

  constructor(
    private childProcess: ChildProcess,
    { streamOutput, prefix }: { streamOutput: boolean; prefix: string }
  ) {
    const { stdout, stderr } = this.childProcess;
    if (!stdout || !stderr) {
      throw new Error('Expected the child process to have piped stdio');
    }
    // Decode as a stream so a code point split across chunks stays intact
    stdout.setEncoding('utf8');
    stderr.setEncoding('utf8');
    if (streamOutput) {
      if (process.env.NX_PREFIX_OUTPUT === 'true') {
        const color = getColor(prefix);
        const prefixText = `${prefix}:`;

        stdout
          .pipe(
            logClearLineToPrefixTransformer(pc.bold(color(prefixText)) + ' ')
          )
          .pipe(addPrefixTransformer(pc.bold(color(prefixText))))
          .pipe(process.stdout);
        stderr
          .pipe(logClearLineToPrefixTransformer(color(prefixText) + ' '))
          .pipe(addPrefixTransformer(color(prefixText)))
          .pipe(process.stderr);
      } else {
        stdout.pipe(addPrefixTransformer()).pipe(process.stdout);
        stderr.pipe(addPrefixTransformer()).pipe(process.stderr);
      }
    }

    // 'close' (not 'exit') ensures stdio has drained before we join chunks (#35302).
    this.childProcess.on('close', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      this.exitCode = code;
      // Join once and cache before notifying exit callbacks
      this.joinedTerminalOutput = this.terminalOutputChunks.join('');
      this.terminalOutputChunks = [];
      for (const cb of this.exitCallbacks) {
        cb(code, this.joinedTerminalOutput);
      }
    });

    // Re-emit any messages from the task process
    this.childProcess.on('message', (message) => {
      if (process.send) {
        process.send(message);
      }
    });
    stdout.on('data', (output: string) => {
      this.terminalOutputChunks.push(output);
      // Stream output to TUI via callbacks
      for (const cb of this.outputCallbacks) {
        cb(output);
      }
    });
    stderr.on('data', (output: string) => {
      this.terminalOutputChunks.push(output);
      // Stream output to TUI via callbacks
      for (const cb of this.outputCallbacks) {
        cb(output);
      }
    });
  }

  onExit(cb: (code: number, terminalOutput: string) => void) {
    this.exitCallbacks.push(cb);
  }

  onOutput(cb: (output: string) => void) {
    this.outputCallbacks.push(cb);
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    if (typeof this.exitCode === 'number') {
      return {
        code: this.exitCode,
        terminalOutput:
          this.joinedTerminalOutput ?? this.terminalOutputChunks.join(''),
      };
    }
    return new Promise((res) => {
      this.onExit((code, terminalOutput) => {
        res({ code, terminalOutput });
      });
    });
  }

  send(message: Serializable): void {
    if (this.childProcess.connected) {
      this.childProcess.send(message);
    }
  }

  public kill(signal?: NodeJS.Signals): Promise<void> {
    if (this.childProcess?.pid) {
      return killProcessTreeGraceful(this.childProcess.pid, signal);
    }
    return Promise.resolve();
  }
}

/**
 * Prevents terminal escape sequence from clearing line prefix.
 */
function logClearLineToPrefixTransformer(prefix: string) {
  let prevChunk: Buffer | string | null = null;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (prevChunk && prevChunk.toString() === '\x1b[2K') {
        chunk = chunk
          .toString()
          .replace(/\x1b\[1G/g, (m: string) => m + prefix);
      }
      this.push(chunk);
      prevChunk = chunk;
      callback();
    },
  });
}

export class NodeChildProcessWithDirectOutput implements RunningTask {
  private terminalOutput: string | undefined;
  private exitCallbacks: Array<
    (code: number, signal: NodeJS.Signals | null) => void
  > = [];

  private exitCode: number | undefined;

  constructor(
    private childProcess: ChildProcess,
    private temporaryOutputPath: string
  ) {
    // Re-emit any messages from the task process
    this.childProcess.on('message', (message) => {
      if (process.send) {
        process.send(message);
      }
    });

    this.childProcess.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);

      this.exitCode = code;

      for (const cb of this.exitCallbacks) {
        cb(code, signal);
      }
    });
  }

  send(message: Serializable): void {
    if (this.childProcess.connected) {
      this.childProcess.send(message);
    }
  }

  onExit(cb: (code: number, signal: NodeJS.Signals | null) => void) {
    this.exitCallbacks.push(cb);
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    const code = this.exitCode ?? (await this.waitForExit());
    const terminalOutput = this.getTerminalOutput();
    return { code, terminalOutput };
  }

  waitForExit() {
    return new Promise<number>((res) => {
      this.onExit((code) => res(code));
    });
  }

  getTerminalOutput() {
    this.terminalOutput ??= readFileSync(this.temporaryOutputPath).toString();
    return this.terminalOutput;
  }

  kill(signal?: NodeJS.Signals): Promise<void> {
    if (this.childProcess?.pid) {
      return killProcessTreeGraceful(this.childProcess.pid, signal);
    }
    return Promise.resolve();
  }
}
