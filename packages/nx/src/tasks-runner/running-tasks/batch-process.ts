import {
  BatchMessage,
  BatchMessageType,
  BatchResults,
} from '../batch/batch-messages';
import { ChildProcess, Serializable } from 'child_process';
import { signalToCode } from '../../utils/exit-codes';

export class BatchProcess {
  private exitCallbacks: Array<(code: number) => void> = [];
  private resultsCallbacks: Array<(results: BatchResults) => void> = [];

  constructor(
    private childProcess: ChildProcess,
    private executorName: string
  ) {
    this.childProcess.on('message', (message: BatchMessage) => {
      switch (message.type) {
        case BatchMessageType.CompleteBatchExecution: {
          for (const cb of this.resultsCallbacks) {
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
  }

  onExit(cb: (code: number) => void) {
    this.exitCallbacks.push(cb);
  }

  onResults(cb: (results: BatchResults) => void) {
    this.resultsCallbacks.push(cb);
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
        this.onResults(res);
      }),
    ]);
  }

  send(message: Serializable): void {
    if (this.childProcess.connected) {
      this.childProcess.send(message);
    }
  }

  kill(signal?: NodeJS.Signals): void {
    if (this.childProcess.connected) {
      this.childProcess.kill(signal);
    }
  }
}
