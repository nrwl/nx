import { Serializable } from 'child_process';
import { RunningTask } from './running-task';

export class NoopChildProcess implements RunningTask {
  constructor(private results: { code: number; terminalOutput: string }) {}

  send(): void {}

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    return this.results;
  }

  kill(): void {
    return;
  }

  onExit(cb: (code: number) => void): void {
    cb(this.results.code);
  }
}
