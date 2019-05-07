import { normalize } from '@angular-devkit/core';
import * as path from 'path';
import RunCommandsBuilder from './run-commands.builder';
import { fileSync } from 'tmp';
import { readFileSync } from 'fs';

function readFile(f: string) {
  return readFileSync(f)
    .toString()
    .replace(/\s/g, '');
}

describe('Command Runner Builder', () => {
  let builder: RunCommandsBuilder;

  beforeEach(() => {
    builder = new RunCommandsBuilder();
  });

  it('should error when no commands are given', async () => {
    const root = normalize('/root');
    try {
      const result = await builder
        .run({
          root,
          builder: '@nrwl/run-commands',
          projectType: 'application',
          options: {} as any
        })
        .toPromise();
      fail('should throw');
    } catch (e) {
      expect(e).toEqual(
        `ERROR: Bad builder config for @nrwl/run-command - "commands" option is required`
      );
    }
  });

  it('should error when no command is given', async () => {
    const root = normalize('/root');
    try {
      const result = await builder
        .run({
          root,
          builder: '@nrwl/run-commands',
          projectType: 'application',
          options: {
            commands: [{}] as any
          }
        })
        .toPromise();
      fail('should throw');
    } catch (e) {
      expect(e).toEqual(
        `ERROR: Bad builder config for @nrwl/run-command - "command" option is required`
      );
    }
  });

  describe('no readyCondition', () => {
    it('should run commands serially', async () => {
      const root = normalize('/root');
      const f = fileSync().name;
      const result = await builder
        .run({
          root,
          builder: '@nrwl/run-commands',
          projectType: 'application',
          options: {
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
        })
        .toPromise();

      expect(result).toEqual({ success: true });
      expect(readFile(f)).toEqual('12');
    });

    it('should run commands in parallel', async () => {
      const root = normalize('/root');
      const f = fileSync().name;
      const result = await builder
        .run({
          root,
          builder: '@nrwl/run-commands',
          projectType: 'application',
          options: {
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
        })
        .toPromise();

      expect(result).toEqual({ success: true });
      expect(readFile(f)).toEqual('21');
    });
  });

  describe('readyWhen', () => {
    it('should error when parallel = false', async () => {
      const root = normalize('/root');
      try {
        const result = await builder
          .run({
            root,
            builder: '@nrwl/run-commands',
            projectType: 'application',
            options: {
              commands: [{ command: 'some command' }],
              parallel: false,
              readyWhen: 'READY'
            }
          })
          .toPromise();
        fail('should throw');
      } catch (e) {
        expect(e).toEqual(
          `ERROR: Bad builder config for @nrwl/run-command - "readyWhen" can only be used when parallel=true`
        );
      }
    });

    it('should return success true when the string specified is ready condition is found', async done => {
      const root = normalize('/root');
      const f = fileSync().name;
      let successEmitted = false;
      builder
        .run({
          root,
          builder: '@nrwl/run-commands',
          projectType: 'application',
          options: {
            commands: [
              {
                command: `echo READY && sleep 0.1 && echo 1 >> ${f}`
              }
            ],
            parallel: true,
            readyWhen: 'READY'
          }
        })
        .subscribe(result => {
          successEmitted = true;
          expect(result).toEqual({ success: true });
          expect(readFile(f)).toEqual('');
        });

      setTimeout(() => {
        if (!successEmitted) {
          fail('Success must be emitted');
        }
        expect(readFile(f)).toEqual('1');
        done();
      }, 150);
    });
  });

  it('should stop execution when a command fails', async () => {
    const root = normalize('/root');
    const f = fileSync().name;
    const result = await builder
      .run({
        root,
        builder: '@nrwl/run-commands',
        projectType: 'application',
        options: {
          commands: [
            {
              command: `echo 1 >> ${f} && exit 1`
            },
            {
              command: `echo 2 >> ${f}`
            }
          ]
        }
      })
      .toPromise();

    expect(result).toEqual({ success: false });
    expect(readFile(f)).toEqual('1');
  });

  it('should throw when invalid args', async () => {
    const root = normalize('/root');
    const f = fileSync().name;

    try {
      await builder
        .run({
          root,
          builder: '@nrwl/run-commands',
          projectType: 'application',
          options: {
            commands: [
              {
                command: `echo {args.key} >> ${f}`
              }
            ],
            args: 'key=value'
          }
        })
        .toPromise();
    } catch (e) {
      expect(e.message).toEqual('Invalid args: key=value');
    }
  });

  it('should enable parameter substitution', async () => {
    const root = normalize('/root');
    const f = fileSync().name;
    const result = await builder
      .run({
        root,
        builder: '@nrwl/run-commands',
        projectType: 'application',
        options: {
          commands: [
            {
              command: `echo {args.key} >> ${f}`
            }
          ],
          args: '--key=value'
        }
      })
      .toPromise();

    expect(result).toEqual({ success: true });
    expect(readFile(f)).toEqual('value');
  });
});
