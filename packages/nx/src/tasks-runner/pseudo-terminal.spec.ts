import { createPseudoTerminal, PseudoTerminal } from './pseudo-terminal';

describe('PseudoTerminal', () => {
  let terminal: PseudoTerminal;
  beforeEach(() => {
    terminal = createPseudoTerminal(true);
  });

  afterAll(() => {
    terminal = undefined;
  });

  it('should run command', async () => {
    const childProcess = terminal.runCommand('echo "hello world"');
    const exitCode = await new Promise((resolve) =>
      childProcess.onExit(resolve)
    );
    expect(exitCode).toEqual(0);
  });

  // 1s (the jest-era budget) is too tight once the suite runs files in
  // parallel: spawning the pty and reaping the kill both contend for CPU.
  it('should kill a running command', { timeout: 10_000 }, async () => {
    const childProcess = terminal.runCommand(
      'sleep 3 && echo "hello world" > file.txt'
    );
    const exited = new Promise((resolve) => childProcess.onExit(resolve));
    childProcess.kill();
    expect(childProcess.isAlive).toEqual(false);
    expect(await exited).not.toEqual(0);
  });

  it('should subscribe to output', async () => {
    const childProcess = terminal.runCommand('echo "hello world"');
    let output = '';
    childProcess.onOutput((chunk) => {
      output += chunk;
    });

    await new Promise((resolve) => childProcess.onExit(resolve));
    expect(output.trim()).toContain('hello world');
  });

  if (process.env.CI !== 'true') {
    it('should be tty', async () => {
      const childProcess = terminal.runCommand(
        'node -p "if (process.stdout.isTTY === undefined) process.exit(1)"'
      );
      const code = await new Promise((resolve) => childProcess.onExit(resolve));
      expect(code).toEqual(0);
    });
  }
});
