import { schema } from '@angular-devkit/core';
import { fileSync } from 'tmp';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { Architect } from '@angular-devkit/architect';
import { join } from 'path';
import { LARGE_BUFFER } from '@nrwl/workspace/src/builders/run-commands/run-commands.impl';

function readFile(f: string) {
  return readFileSync(f).toString().replace(/\s/g, '');
}

describe('Command Runner Builder', () => {
  let architect: Architect;
  beforeEach(async () => {
    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    const testArchitectHost = new TestingArchitectHost('/root', '/root');

    architect = new Architect(testArchitectHost, registry);
    await testArchitectHost.addBuilderFromPackage(join(__dirname, '../../..'));
  });

  it('should run one command', async () => {
    const f = fileSync().name;
    const scheduleRun = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        command: `echo 1 >> ${f}`,
      }
    );
    //wait a tick for the serial runner to schedule the first task
    await Promise.resolve();
    const run = await scheduleRun;
    const result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('1');
  });

  it('should interpolate provided --args', async () => {
    const f = fileSync().name;
    const scheduleRun = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        command: `echo {args.key} >> ${f}`,
        args: '--key=123',
      }
    );
    //wait a tick for the serial runner to schedule the first task
    await Promise.resolve();
    const run = await scheduleRun;
    const result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should interpolate all unknown args as if they were --args', async () => {
    const f = fileSync().name;
    const scheduleRun = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        command: `echo {args.key} >> ${f}`,
        key: 123,
      }
    );
    //wait a tick for the serial runner to schedule the first task
    await Promise.resolve();
    const run = await scheduleRun;
    const result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('123');
  });

  it('should add all args to the command if no interpolation in the command', async () => {
    const exec = spyOn(require('child_process'), 'execSync').and.callThrough();

    const scheduleRun = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        command: `echo`,
        a: 123,
        b: 456,
      }
    );

    //wait a tick for the serial runner to schedule the first task
    await Promise.resolve();
    const run = await scheduleRun;

    expect(exec).toHaveBeenCalledWith(`echo --a=123 --b=456`, {
      stdio: [0, 1, 2],
      cwd: undefined,
      env: process.env,
      maxBuffer: LARGE_BUFFER,
    });
  });

  it('should throw when invalid args', async () => {
    try {
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          command: `echo {args.key}`,
          args: 'key=value',
        }
      );
      await run.result;
    } catch (e) {
      expect(e.message).toEqual('Invalid args: key=value');
    }
  });

  it('should run commands serially', async () => {
    const f = fileSync().name;
    const scheduleRun = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        commands: [`sleep 0.2 && echo 1 >> ${f}`, `echo 2 >> ${f}`],
        parallel: false,
      }
    );
    //wait a tick for the serial runner to schedule the first task
    await Promise.resolve();
    const run = await scheduleRun;
    const result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('12');
  });

  it('should run commands in parallel', async () => {
    const f = fileSync().name;
    const scheduleRun = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        commands: [
          {
            command: `echo 1 >> ${f}`,
          },
          {
            command: `echo 2 >> ${f}`,
          },
        ],
        parallel: true,
      }
    );
    const run = await scheduleRun;
    const result = await run.result;
    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    const contents = readFile(f);
    expect(contents).toContain(1);
    expect(contents).toContain(2);
  });

  describe('readyWhen', () => {
    it('should error when parallel = false', async () => {
      try {
        const run = await architect.scheduleBuilder(
          '@nrwl/workspace:run-commands',
          {
            commands: [{ command: 'some command' }],
            parallel: false,
            readyWhen: 'READY',
          }
        );
        await run.result;
        fail('should throw');
      } catch (e) {
        expect(e).toEqual(
          `ERROR: Bad builder config for @nrwl/run-commands - "readyWhen" can only be used when parallel=true`
        );
      }
    });

    it('should return success true when the string specified is ready condition is found', async (done) => {
      const f = fileSync().name;
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo READY && sleep 0.1 && echo 1 >> ${f}`,
            },
          ],
          parallel: true,
          readyWhen: 'READY',
        }
      );
      let successEmitted = false;
      run.output.subscribe((result) => {
        successEmitted = true;
        expect(result.success).toEqual(true);
        expect(readFile(f)).toEqual('');
      });
      setTimeout(() => {
        expect(successEmitted).toEqual(true);
        expect(readFile(f)).toEqual('1');
        done();
      }, 150);
    });
  });

  it('should stop execution when a command fails', async () => {
    const f = fileSync().name;

    try {
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [`echo 1 >> ${f} && exit 1`, `echo 2 >> ${f}`],
          parallel: false,
        }
      );
      await run.result;
    } catch (e) {}
    expect(readFile(f)).toEqual('1');
  });

  describe('--color', () => {
    it('should not set FORCE_COLOR=true', async () => {
      const exec = spyOn(require('child_process'), 'exec').and.callThrough();
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo 'Hello World'`,
            },
          ],
        }
      );

      await run.result;

      expect(exec).toHaveBeenCalledWith(`echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env },
      });
    });

    it('should set FORCE_COLOR=true when running with --color', async () => {
      const exec = spyOn(require('child_process'), 'exec').and.callThrough();
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo 'Hello World'`,
            },
          ],
          color: true,
        }
      );

      await run.result;

      expect(exec).toHaveBeenCalledWith(`echo 'Hello World'`, {
        maxBuffer: LARGE_BUFFER,
        env: { ...process.env, FORCE_COLOR: `true` },
      });
    });
  });

  it('should run the task in the specified working directory', async () => {
    const f = fileSync().name;
    let run = await architect.scheduleBuilder('@nrwl/workspace:run-commands', {
      commands: [
        {
          command: `pwd >> ${f}`,
        },
      ],
    });

    let result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).not.toContain('/packages');

    run = await architect.scheduleBuilder('@nrwl/workspace:run-commands', {
      commands: [
        {
          command: `pwd >> ${f}`,
        },
      ],
      cwd: 'packages',
    });

    result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
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
      let run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo $NRWL_SITE >> ${f}`,
            },
          ],
        }
      );

      let result = await run.result;

      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nrwl.io/');
    });

    it('should load the specified .env file instead of the root one', async () => {
      const devEnv = fileSync().name;
      writeFileSync(devEnv, 'NX_SITE=https://nx.dev/');
      let f = fileSync().name;
      let run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
            },
          ],
          envFile: devEnv,
        }
      );

      let result = await run.result;

      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('https://nx.dev/');
    });

    it('should error if the specified .env file does not exist', async () => {
      let f = fileSync().name;
      let run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo $NX_SITE >> ${f} && echo $NRWL_SITE >> ${f}`,
            },
          ],
          envFile: '/somePath/.fakeEnv',
        }
      );

      await expect(run.result).rejects.toThrow(
        `no such file or directory, open '/somePath/.fakeEnv'`
      );
    });
  });
});
