import { schema } from '@angular-devkit/core';
import { fileSync } from 'tmp';
import { readFileSync } from 'fs';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { Architect } from '@angular-devkit/architect';
import { join } from 'path';

function readFile(f: string) {
  return readFileSync(f)
    .toString()
    .replace(/\s/g, '');
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

  // TODO re-enable test when https://github.com/angular/angular-cli/pull/14315 is merged
  xit('should error when no commands are given', async () => {
    try {
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {}
      );
      await run.output.toPromise();
      fail('should throw');
    } catch (e) {
      expect(e).toEqual(
        `ERROR: Bad builder config for @nrwl/run-command - "command" option is required`
      );
    }
  });

  // TODO re-enable test when https://github.com/angular/angular-cli/pull/14315 is merged
  xit('should error when no command is given', async () => {
    try {
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [{}]
        }
      );
      await run.result;
      fail('should throw');
    } catch (e) {
      expect(e).toEqual(
        `ERROR: Bad builder config for @nrwl/run-command - "command" option is required`
      );
    }
  });

  describe('no readyCondition', () => {
    it('should run commands serially', async () => {
      const f = fileSync().name;
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `sleep 0.2 && echo 1 >> ${f}`
            },
            {
              command: `sleep 0.1 && echo 2 >> ${f}`
            }
          ],
          parallel: false
        }
      );
      const result = await run.result;

      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('12');
    });

    it('should run commands in parallel', async () => {
      const f = fileSync().name;
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `sleep 0.2 && echo 1 >> ${f}`
            },
            {
              command: `sleep 0.1 && echo 2 >> ${f}`
            }
          ],
          parallel: true
        }
      );
      const result = await run.result;

      expect(result).toEqual(jasmine.objectContaining({ success: true }));
      expect(readFile(f)).toEqual('21');
    });
  });

  describe('readyWhen', () => {
    it('should error when parallel = false', async () => {
      try {
        const run = await architect.scheduleBuilder(
          '@nrwl/workspace:run-commands',
          {
            commands: [{ command: 'some command' }],
            parallel: false,
            readyWhen: 'READY'
          }
        );
        await run.result;
        fail('should throw');
      } catch (e) {
        expect(e).toEqual(
          `ERROR: Bad builder config for @nrwl/run-command - "readyWhen" can only be used when parallel=true`
        );
      }
    });

    it('should return success true when the string specified is ready condition is found', async done => {
      const f = fileSync().name;
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo READY && sleep 0.1 && echo 1 >> ${f}`
            }
          ],
          parallel: true,
          readyWhen: 'READY'
        }
      );
      let successEmitted = false;
      run.output.subscribe(result => {
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
    const run = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        commands: [
          {
            command: `echo 1 >> ${f} && exit 1`
          },
          {
            command: `echo 2 >> ${f}`
          }
        ],
        parallel: false
      }
    );

    const result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: false }));
    expect(readFile(f)).toEqual('1');
  });

  it('should throw when invalid args', async () => {
    const f = fileSync().name;

    try {
      const run = await architect.scheduleBuilder(
        '@nrwl/workspace:run-commands',
        {
          commands: [
            {
              command: `echo {args.key} >> ${f}`
            }
          ],
          args: 'key=value'
        }
      );
      await run.result;
    } catch (e) {
      expect(e.message).toEqual('Invalid args: key=value');
    }
  });

  it('should enable parameter substitution', async () => {
    const f = fileSync().name;
    const run = await architect.scheduleBuilder(
      '@nrwl/workspace:run-commands',
      {
        commands: [
          {
            command: `echo {args.key} >> ${f}`
          }
        ],
        args: '--key=value'
      }
    );

    const result = await run.result;

    expect(result).toEqual(jasmine.objectContaining({ success: true }));
    expect(readFile(f)).toEqual('value');
  });
});
