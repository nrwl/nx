import { createPseudoTerminal, PseudoTerminal } from './pseudo-terminal';

describe('PseudoTerminal', () => {
  let terminal: PseudoTerminal;
  beforeEach(() => {
    terminal = createPseudoTerminal(true);
  });

  afterAll(() => {
    terminal = undefined;
  });

  it('should run command', (done) => {
    const childProcess = terminal.runCommand('echo "hello world"');
    childProcess.onExit((exitCode) => {
      expect(exitCode).toEqual(0);
      done();
    });
  });

  it('should kill a running command', (done) => {
    const childProcess = terminal.runCommand(
      'sleep 3 && echo "hello world" > file.txt'
    );
    childProcess.onExit((exit_code) => {
      expect(exit_code).not.toEqual(0);
      done();
    });
    childProcess.kill();
    expect(childProcess.isAlive).toEqual(false);
  }, 1000);

  it('should subscribe to output', (done) => {
    const childProcess = terminal.runCommand('echo "hello world"');
    let output = '';
    childProcess.onOutput((chunk) => {
      output += chunk;
    });

    childProcess.onExit(() => {
      try {
        expect(output.trim()).toContain('hello world');
      } finally {
        done();
      }
    });
  });

  // TODO(@FrozenPandaz): Re-enable this test once multiple run_command invocations with the pseudo terminal is fixed
  it.skip('should get results', async () => {
    const childProcess = terminal.runCommand('echo "hello world"');

    const results = await childProcess.getResults();

    expect(results.code).toEqual(0);
    expect(results.terminalOutput).toContain('hello world');
    const childProcess2 = terminal.runCommand('echo "hello jason"');

    const results2 = await childProcess2.getResults();

    expect(results2.code).toEqual(0);
    expect(results2.terminalOutput).toContain('hello jason');
  });

  if (process.env.CI !== 'true') {
    it('should be tty', (done) => {
      const childProcess = terminal.runCommand(
        'node -p "if (process.stdout.isTTY === undefined) process.exit(1)"'
      );
      childProcess.onExit((code) => {
        expect(code).toEqual(0);
        done();
      });
    });
  }

  // TODO(@FrozenPandaz): Re-enable this test once multiple run_command invocations with the pseudo terminal is fixed
  it.skip('should run multiple commands', async () => {
    let i = 0;
    while (i < 10) {
      const childProcess = terminal.runCommand('whoami', {});

      await childProcess.getResults();

      i++;
    }
  });
});
