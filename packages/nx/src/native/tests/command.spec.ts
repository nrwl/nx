import { PseudoTtyProcess } from '../../utils/child-process';
import { runCommand } from '../index';

describe('runCommand', () => {
  it('should run command', async () => {
    const childProcess = runCommand('echo "hello world"', process.cwd());
    expect(() => {
      childProcess.onExit((exitCode) => expect(exitCode).toEqual(0));
    });
  });
  it('should kill a running command', () => {
    const childProcess = new PseudoTtyProcess(
      runCommand('sleep 3 && echo "hello world" > file.txt', process.cwd())
    );
    childProcess.onExit((exit_code) => {
      expect(exit_code).not.toEqual(0);
    });
    childProcess.kill();
    expect(childProcess.isAlive).toEqual(false);
  }, 1000);

  it('should subscribe to output', (done) => {
    const childProcess = runCommand('echo "hello world"', process.cwd());

    let output = '';
    childProcess.onOutput((chunk) => {
      output += chunk;
    });

    childProcess.onExit(() => {
      expect(output.trim()).toContain('hello world');
      done();
    });
  });

  it('should be tty', (done) => {
    const childProcess = runCommand('node -p "process.stdout.isTTY"');
    let output = '';
    childProcess.onOutput((out) => {
      output += out.trim();
      // check to make sure that we have ansi sequence characters only available in tty terminals
    });
    childProcess.onExit((_) => {
      expect(JSON.stringify(output)).toContain('\\u001b[33mtrue\\u001b[39m');
      done();
    });
  });
});
