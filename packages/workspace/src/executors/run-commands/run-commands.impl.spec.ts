import { fileSync } from 'tmp';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import runCommands, { LARGE_BUFFER } from './run-commands.impl';

function readFile(f: string) {
  return readFileSync(f).toString().replace(/\s/g, '');
}

describe('Command Runner Builder', () => {
  it('should run one command', async () => {
    const f = fileSync().name;
    const result = await runCommands({
      command: `echo 1 >> ${f}`,
    });
    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('1');
  });

  it('should interpolate provided --args', async () => {
    const f = fileSync().name;
    const result = await runCommands({
      command: `echo {args.key} >> ${f}`,
      args: '--key=123',
    });
    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should interpolate all unknown args as if they were --args', async () => {
    const f = fileSync().name;
    const result = await runCommands({
      command: `echo {args.key} >> ${f}`,
      key: 123,
    });
    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should add all args to the command if no interpolation in the command', async () => {
    const exec = spyOn(require('child_process'), 'execSync').and.callThrough();

    await runCommands({
      command: `echo`,
      a: 123,
      b: 456,
    });
    expect(exec).toHaveBeenCalledWith(`echo --a=123 --b=456`, {
      stdio: [0, 1, 2],
      cwd: undefined,
      env: process.env,
      maxBuffer: LARGE_BUFFER,
    });
  });

  it('ssss should forward args by default when using commands (plural)', async () => {
    const exec = spyOn(require('child_process'), 'exec').and.callThrough();

    await runCommands({
      commands: [{ command: 'echo' }],
      parallel: true,
      a: 123,
      b: 456,
    });

    expect(exec).toHaveBeenCalledWith('echo --a=123 --b=456', {
      maxBuffer: LARGE_BUFFER,
      env: { ...process.env },
    });
  });

  it('should forward args when forwardAllArgs is set to true', async () => {
    const exec = spyOn(require('child_process'), 'exec').and.callThrough();

    await runCommands({
      commands: [{ command: 'echo', forwardAllArgs: true }],
      parallel: true,
      a: 123,
      b: 456,
    });

    expect(exec).toHaveBeenCalledWith('echo --a=123 --b=456', {
      maxBuffer: LARGE_BUFFER,
      env: { ...process.env },
    });
  });

  it('should not forward args when forwardAllArgs is set to false', async () => {
    const exec = spyOn(require('child_process'), 'exec').and.callThrough();

    await runCommands({
      commands: [{ command: 'echo', forwardAllArgs: false }],
      parallel: true,
      a: 123,
      b: 456,
    });

    expect(exec).toHaveBeenCalledWith('echo', {
      maxBuffer: LARGE_BUFFER,
      env: { ...process.env },
    });
  });

  it('should throw when invalid args', async () => {
    try {
      await runCommands({
        command: `echo {args.key}`,
        args: 'key=value',
      });
    } catch (e) {
      expect(e.message).toEqual('Invalid args: key=value');
    }
  });

  it('should run commands serially', async () => {
    const f = fileSync().name;
    const result = await runCommands({
      commands: [`sleep 0.2 && echo 1 >> ${f}`, `echo 2 >> ${f}`],
      parallel: false,
    });
    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('12');
  });

  it('should run commands in parallel', async () => {
    const f = fileSync().name;
    const result = await runCommands({
      commands: [
        {
          command: `echo 1 >> ${f}`,
        },
        {
          command: `echo 2 >> ${f}`,
        },
      ],
      parallel: true,
    });
    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    const contents = readFile(f);
    expect(contents).toContain(1);
    expect(contents).toContain(2);
  });

  describe('readyWhen', () => {
    it('should error when parallel = false', async () => {
      try {
        await runCommands({
          commands: [{ command: 'some command' }],
          parallel: false,
          readyWhen: 'READY',
        });
        fail('should throw');
      } catch (e) {
        expect(e.message).toEqual(
          `ERROR: Bad builder config for @nrwl/run-commands - "readyWhen" can only be used when parallel=true`
        );
      }
    });

    it('should return success true when the string specified is ready condition is found', async (done) => {
      const f = fileSync().name;
      const result = await runCommands({
        commands: [
          {
            command: `echo READY && sleep 0.1 && echo 1 >> ${f}`,
          },
        ],
        parallel: true,
        readyWhen: 'READY',
      });
      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('');

      setTimeout(() => {
        expect(readFile(f)).toEqual('1');
        done();
      }, 150);
    });
  });

  it('should stop execution and fail when a command fails', async () => {
    const f = fileSync().name;

    try {
      await runCommands({
        commands: [`echo 1 >> ${f} && exit 1`, `echo 2 >> ${f}`],
        parallel: false,
      });
      fail('should fail when a command fails');
    } catch (e) {}
    expect(readFile(f)).toEqual('1');
  });

  describe('--color', () => {
    it('should not set FORCE_COLOR=true', async () => {
      const exec = spyOn(require('child_process'), 'exec').and.callThrough();
      await runCommands({
        commands: [
          {
            command: `echo 'Hello World'`,
          },
        ],
        parallel: true,
      });

      expect(exec).toHaveBeenCalledWith(`echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env },
      });
    });

    it('should set FORCE_COLOR=true when running with --color', async () => {
      const exec = spyOn(require('child_process'), 'exec').and.callThrough();
      await runCommands({
        commands: [
          {
            command: `echo 'Hello World'`,
          },
        ],
        parallel: true,
        color: true,
      });

      expect(exec).toHaveBeenCalledWith(`echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env, FORCE_COLOR: `true` },
      });
    });
  });

  it('should run the task in the specified working directory', async () => {
    const f = fileSync().name;
    const result = await runCommands({
      commands: [
        {
          command: `pwd >> ${f}`,
        },
      ],
      parallel: true,
    });

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).not.toContain('/packages');

    const result2 = await runCommands({
      commands: [
        {
          command: `pwd >> ${f}`,
        },
      ],
      parallel: true,
      cwd: 'packages',
    });

    expect(result2).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toContain('/packages');
  });

  describe('dotenv', () => {
    beforeAll(() => {
      writeFileSync('.env', 'NRWL_SITE=https://nrwl.io/');
    });

    beforeEach(() => {
      delete process.env.NRWL_SITE;
      delete process.env.NX_SITE;
    });

    afterAll(() => {
      unlinkSync('.env');
    });

    it('should load the root .env file by default if there is one', async () => {
      let f = fileSync().name;
      const result = await runCommands({
        commands: [
          {
            command: `echo $NRWL_SITE >> ${f}`,
          },
        ],
      });

      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nrwl.io/');
    });

    it('should load the specified .env file instead of the root one', async () => {
      const devEnv = fileSync().name;
      writeFileSync(devEnv, 'NX_SITE=https://nx.dev/');
      let f = fileSync().name;
      const result = await runCommands({
        commands: [
          {
            command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
          },
        ],
        envFile: devEnv,
      });

      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nx.dev/');
    });

    it('should error if the specified .env file does not exist', async () => {
      let f = fileSync().name;
      try {
        await runCommands({
          commands: [
            {
              command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
            },
          ],
          envFile: '/somePath/.fakeEnv',
        });
        fail('should not reach');
      } catch (e) {
        expect(e.message).toContain(
          `no such file or directory, open '/somePath/.fakeEnv'`
        );
      }
    });
  });
});
