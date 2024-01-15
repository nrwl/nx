import { runCommand } from '../index';

describe('runCommand', () => {
  it('should run command', async () => {
    const childProcess = runCommand('echo "hello world"', process.cwd());
    expect(() => {
      childProcess.onExit((exitCode) => expect(exitCode).toEqual(0));
    });
  });
  it('should kill a running command', () => {
    const childProcess = runCommand(
      'sleep 3 && echo "hello world" > file.txt',
      process.cwd()
    );
    childProcess.onExit((exit_code) => {
      expect(exit_code).not.toEqual(0);
    });
    childProcess.kill();
  }, 1000);

  it('should subscribe to output', (done) => {
    const childProcess = runCommand('echo "hello world"', process.cwd());

    childProcess.onOutput((output) => {
      expect(output.trim()).toEqual('hello world');
    });

    childProcess.onExit((exitCode) => {
      done();
    });
  });

  it('should be tty', (done) => {
    const childProcess = runCommand('node -p "process.stdout.isTTY"');
    childProcess.onOutput((out) => {
      let output = JSON.stringify(out.trim());
      // check to make sure that we have ansi sequence characters only available in tty terminals
      expect(output).toMatchInlineSnapshot(`""\\u001b[33mtrue\\u001b[39m""`);
    });
    childProcess.onExit((_) => {
      done();
    });
  });
});
