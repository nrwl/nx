import type { Serializable } from 'child_process';

export abstract class RunningTask {
  abstract getResults(): Promise<{ code: number; terminalOutput: string }>;

  abstract onExit(cb: (code: number) => void): void;

  abstract kill(signal?: NodeJS.Signals | number): Promise<void> | void;

  abstract onOutput?(cb: (output: string) => void): void;

  abstract send?(message: Serializable): void;
}
