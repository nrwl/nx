import { normalize } from '@angular-devkit/core';
import * as path from 'path';
import RunCommandsBuilder from './run-commands.builder';
import { fileSync } from 'tmp';
import { readFileSync } from 'fs';

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
          ]
        }
      })
      .toPromise();

    expect(result).toEqual({ success: true });
    expect(
      readFileSync(f)
        .toString()
        .replace(/\s/g, '')
    ).toEqual('12');
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
    expect(
      readFileSync(f)
        .toString()
        .replace(/\s/g, '')
    ).toEqual('21');
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
    expect(
      readFileSync(f)
        .toString()
        .replace(/\s/g, '')
    ).toEqual('1');
  });
});
