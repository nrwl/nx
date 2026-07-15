import { execCommand } from './exec-command';

describe('execCommand', () => {
  it('captures stdout and a zero exit code on success', async () => {
    const result = await execCommand(
      process.execPath,
      ['-e', "process.stdout.write('hello')"],
      {
        silent: true,
      }
    );
    expect(result.stdout).toEqual('hello');
    expect(result.exitCode).toEqual(0);
  });

  it('captures stderr and a non-zero exit code on failure', async () => {
    const result = await execCommand(
      process.execPath,
      ['-e', "process.stderr.write('boom'); process.exit(1)"],
      { silent: true }
    );
    expect(result.stderr).toEqual('boom');
    expect(result.exitCode).toEqual(1);
  });

  it('rejects when the command cannot be spawned', async () => {
    await expect(
      execCommand('this-binary-does-not-exist-xyz', [], { silent: true })
    ).rejects.toThrow();
  });
});
