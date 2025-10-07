import { ChildProcess, Serializable } from 'child_process';
import { signalToCode } from '../../utils/exit-codes';
import { RunningTask } from './running-task';
import { Transform } from 'stream';
import * as chalk from 'chalk';
import { readFileSync } from 'fs';

export class NodeChildProcessWithNonDirectOutput implements RunningTask {
  private terminalOutput: string = '';
  private exitCallbacks: Array<(code: number, terminalOutput: string) => void> =
    [];
  private outputCallbacks: Array<(output: string) => void> = [];

  private exitCode: number;

  constructor(
    private childProcess: ChildProcess,
    { streamOutput, prefix }: { streamOutput: boolean; prefix: string }
  ) {
    if (streamOutput) {
      if (process.env.NX_PREFIX_OUTPUT === 'true') {
        const color = getColor(prefix);
        const prefixText = `${prefix}:`;

        this.childProcess.stdout
          .pipe(logClearLineToPrefixTransformer(color.bold(prefixText) + ' '))
          .pipe(addPrefixTransformer(color.bold(prefixText)))
          .pipe(process.stdout);
        this.childProcess.stderr
          .pipe(logClearLineToPrefixTransformer(color(prefixText) + ' '))
          .pipe(addPrefixTransformer(color(prefixText)))
          .pipe(process.stderr);
      } else {
        this.childProcess.stdout
          .pipe(addPrefixTransformer())
          .pipe(process.stdout);
        this.childProcess.stderr
          .pipe(addPrefixTransformer())
          .pipe(process.stderr);
      }
    }

    this.childProcess.on('exit', (code, signal) => {
      if (code === null) code = signalToCode(signal);
      this.exitCode = code;
      for (const cb of this.exitCallbacks) {
        cb(code, this.terminalOutput);
      }
    });

    // Re-emit any messages from the task process
    this.childProcess.on('message', (message) => {
      if (process.send) {
        process.send(message);
      }
    });
    this.childProcess.stdout.on('data', (chunk) => {
      const output = chunk.toString();
      this.terminalOutput += output;
      // Stream output to TUI via callbacks
      for (const cb of this.outputCallbacks) {
        cb(output);
      }
    });
    this.childProcess.stderr.on('data', (chunk) => {
      const output = chunk.toString();
      this.terminalOutput += output;
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
        terminalOutput: this.terminalOutput,
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
  public kill(signal?: NodeJS.Signals) {
    if (this.childProcess.connected) {
      this.childProcess.kill(signal);
    }
  }
}

function addPrefixTransformer(prefix?: string) {
  const newLineSeparator = process.platform.startsWith('win') ? '\r\n' : '\n';
  return new Transform({
    transform(chunk, _encoding, callback) {
      const list = chunk.toString().split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/g);
      list
        .filter(Boolean)
        .forEach((m) =>
          this.push(
            prefix ? prefix + ' ' + m + newLineSeparator : m + newLineSeparator
          )
        );
      callback();
    },
  });
}

const colors = [
  chalk.green,
  chalk.greenBright,
  chalk.blue,
  chalk.blueBright,
  chalk.cyan,
  chalk.cyanBright,
  chalk.yellow,
  chalk.yellowBright,
  chalk.magenta,
  chalk.magentaBright,
];

function getColor(projectName: string) {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  const colorIndex = code % colors.length;

  return colors[colorIndex];
}

/**
 * Prevents terminal escape sequence from clearing line prefix.
 */
function logClearLineToPrefixTransformer(prefix: string) {
  let prevChunk = null;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (prevChunk && prevChunk.toString() === '\x1b[2K') {
        chunk = chunk.toString().replace(/\x1b\[1G/g, (m) => m + prefix);
      }
      this.push(chunk);
      prevChunk = chunk;
      callback();
    },
  });
}

export class NodeChildProcessWithDirectOutput implements RunningTask {
  private terminalOutput: string | undefined;
  private exitCallbacks: Array<(code: number, signal: string) => void> = [];

  private exited = false;
  private exitCode: number;

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

      this.exited = true;
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

  onExit(cb: (code: number, signal: NodeJS.Signals) => void) {
    this.exitCallbacks.push(cb);
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    if (!this.exited) {
      await this.waitForExit();
    }
    const terminalOutput = this.getTerminalOutput();
    return { code: this.exitCode, terminalOutput };
  }

  waitForExit() {
    return new Promise<void>((res) => {
      this.onExit(() => res());
    });
  }

  getTerminalOutput() {
    this.terminalOutput ??= readFileSync(this.temporaryOutputPath).toString();
    return this.terminalOutput;
  }

  kill(signal?: NodeJS.Signals): void {
    if (this.childProcess.connected) {
      this.childProcess.kill(signal);
    }
  }
}
