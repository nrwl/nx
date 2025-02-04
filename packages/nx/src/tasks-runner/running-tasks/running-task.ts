export abstract class RunningTask {
  abstract getResults(): Promise<{ code: number; terminalOutput: string }>;

  abstract onExit(cb: (code: number) => void): void;

  abstract kill(signal?: NodeJS.Signals | number): Promise<void> | void;
}
