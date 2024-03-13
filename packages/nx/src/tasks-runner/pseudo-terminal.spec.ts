import { getPseudoTerminal, PseudoTerminal } from './pseudo-terminal';

describe('PseudoTerminal', () => {
  let terminal: PseudoTerminal;
  beforeAll(() => {
    terminal = getPseudoTerminal();
  });

  afterAll(() => {
    terminal.kill();
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
      expect(output.trim()).toContain('hello world');
      done();
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

  it('should run multiple commands', (done) => {
    const cp1 = terminal.runCommand('echo "hello"', {});

    cp1.onExit(() => {
      const cp2 = terminal.runCommand('echo "world"');
      cp2.onExit(done);
    });
  });
});
