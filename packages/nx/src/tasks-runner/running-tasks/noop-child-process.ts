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

  onExit(cb: (code: number, terminalOutput: string) => void): void {
    cb(this.results.code, this.results.terminalOutput);
  }

  onOutput(cb: (terminalOutput: string) => void): void {
    cb(this.results.terminalOutput);
  }
}
