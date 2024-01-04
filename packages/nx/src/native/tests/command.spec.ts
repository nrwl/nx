import { runCommand } from '../index';
import { fork } from 'child_process';

describe('runCommand', () => {
  it('should run command', async () => {
    const childProcess = runCommand('echo "hello world"', process.cwd());
    expect(childProcess.isAlive()).toEqual(true);
    expect(await childProcess.wait()).toEqual(0);
    expect(childProcess.isAlive()).toEqual(false);
  });
  it('should kill a running command', () => {
    const childProcess = runCommand(
      'sleep 3 && echo "hello world" > file.txt',
      process.cwd()
    );
    expect(childProcess.isAlive()).toEqual(true);
    childProcess.wait().then(() => {
      throw new Error('should not have completed');
    });
    childProcess.kill();
    expect(childProcess.isAlive()).toEqual(false);
  }, 1000);

  // it('should emit ipc events', () => {
  //   const childProcess = runCommand(
  //     'node -e "process.send({ msg: 0 })"',
  //     process.cwd()
  //   );
  //
  //   childProcess.onMessage((msg) => {
  //     expect(msg).toEqual({ msg: 0 });
  //   });
  // });
});
