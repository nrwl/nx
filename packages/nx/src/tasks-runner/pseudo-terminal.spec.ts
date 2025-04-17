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
});
