import * as stream from 'node:stream';
import * as yargs from 'yargs';

import {
  readParallelFromArgsAndEnv,
  withAffectedOptions,
  withOutputStyleOption,
  withRunManyOptions,
  withTuiOptions,
  parseCSV,
} from './shared-options';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';

const argv = yargs.default([]);

describe('shared-options', () => {
  describe('withAffectedOptions', () => {
    const command = withAffectedOptions(argv);

    it('should parse files to array', async () => {
      const result = await command.parseAsync([
        'affected',
        '--files',
        'file1',
        '--files',
        'file2',
        '--tag',
        '81919e4',
        '--parallel',
        '3',
        '--maxParallel',
        '2',
      ]);
      expect(result).toEqual(
        expect.objectContaining({
          _: ['affected', '--tag', '81919e4'],
          files: ['file1', 'file2'],
          parallel: '3',
          maxParallel: 2,
        })
      );
    });

    it('should parse files from stdin', async () => {
      const stdinMock = new stream.PassThrough();
      jest.spyOn(process, 'stdin', 'get').mockReturnValue(stdinMock as any);

      stdinMock.push('file1,file');
      stdinMock.push('2,file3');
      stdinMock.push(null);

      const result = await command.parseAsync(['affected', '--stdin']);

      expect(result).toEqual(
        expect.objectContaining({
          _: ['affected'],
          files: ['file1', 'file2', 'file3'],
        })
      );

      stdinMock.end();
    });

    it('should parse files from stdin and a single --files option', async () => {
      const stdinMock = new stream.PassThrough();
      jest.spyOn(process, 'stdin', 'get').mockReturnValue(stdinMock as any);

      stdinMock.push('file1,file');
      stdinMock.push('2,file3');
      stdinMock.push(null);

      const result = await command.parseAsync([
        'affected',
        '--stdin',
        '--files',
        'file4',
      ]);

      expect(result).toEqual(
        expect.objectContaining({
          _: ['affected'],
          files: ['file1', 'file2', 'file3', 'file4'],
        })
      );

      stdinMock.end();
    });

    it('should parse files from stdin and multiple --files options', async () => {
      const stdinMock = new stream.PassThrough();
      jest.spyOn(process, 'stdin', 'get').mockReturnValue(stdinMock as any);

      stdinMock.push('file1,file');
      stdinMock.push('2');
      stdinMock.push(null);

      const result = await command.parseAsync([
        'affected',
        '--stdin',
        '--files',
        'file3',
        '--files',
        'file4',
      ]);

      expect(result).toEqual(
        expect.objectContaining({
          _: ['affected'],
          files: ['file1', 'file2', 'file3', 'file4'],
        })
      );

      stdinMock.end();
    });

    it('should parse head and base', async () => {
      const result = await command.parseAsync([
        'affected',
        '--head',
        'head',
        '--base',
        'base',
      ]);
      expect(result).toEqual(
        expect.objectContaining({
          _: ['affected'],
          head: 'head',
          base: 'base',
        })
      );
    });
  });

  describe('withRunManyOptions', () => {
    const command = withRunManyOptions(argv);

    it('should parse projects to array', async () => {
      const result = await command.parseAsync([
        'run-many',
        '--projects',
        'project1',
        '--projects',
        'project2',
        '--tag',
        '81919e4',
        '--parallel',
        '3',
        '--maxParallel',
        '2',
      ]);
      expect(result).toEqual(
        expect.objectContaining({
          _: ['run-many', '--tag', '81919e4'],
          projects: ['project1', 'project2'],
          parallel: '3',
          maxParallel: 2,
        })
      );
    });
  });

  describe('withOutputStyle', () => {
    it('should coerce outputStyle based on NX_TUI', () =>
      withEnvironmentVariables(
        {
          NX_TUI: 'true',
          CI: 'false',
          NX_TUI_SKIP_CAPABILITY_CHECK: 'true',
        },
        () => {
          const command = withOutputStyleOption(argv);
          const result = command.parseSync([]);
          expect(result['output-style']).toEqual('tui');
        }
      ));

    it('should use NX_DEFAULT_OUTPUT_STYLE if not set', () =>
      withEnvironmentVariables(
        {
          NX_TUI: false,
          CI: 'false',
          NX_TUI_SKIP_CAPABILITY_CHECK: 'true',
          NX_DEFAULT_OUTPUT_STYLE: 'stream-without-prefixes',
        },
        () => {
          const command = withOutputStyleOption(argv);
          const result = command.parseSync([]);
          expect(result.outputStyle).toEqual('stream-without-prefixes');
        }
      ));

    it('should set NX_TUI if using not set', () =>
      withEnvironmentVariables(
        {
          NX_TUI: false,
          CI: 'false',
          NX_TUI_SKIP_CAPABILITY_CHECK: 'true',
        },
        () => {
          const command = withOutputStyleOption(argv);
          const result = command.parseSync([]);
          expect(process.env.NX_TUI).toEqual('true');
        }
      ));

    it.each(['dynamic', 'tui'])(
      'should set NX_TUI if using output-style=%s',
      () =>
        withEnvironmentVariables(
          {
            NX_TUI: false,
            CI: 'false',
            NX_TUI_SKIP_CAPABILITY_CHECK: 'true',
          },
          () => {
            const command = withOutputStyleOption(argv);
            const result = command.parseSync(['--output-style', 'dynamic']);
            expect(process.env.NX_TUI).toEqual('true');
          }
        )
    );

    it('should enable the tui when flag set', () =>
      withEnvironmentVariables(
        {
          NX_TUI: 'false',
          CI: 'false',
          NX_TUI_SKIP_CAPABILITY_CHECK: 'true',
        },
        () => {
          const command = withOutputStyleOption(withTuiOptions(argv));
          command.parseSync(['--tui']);
          expect(process.env.NX_TUI).toEqual('true');
        }
      ));

    it('should disable the tui when flag set to false', () =>
      withEnvironmentVariables(
        {
          NX_TUI: 'true',
          CI: 'false',
          NX_TUI_SKIP_CAPABILITY_CHECK: 'true',
        },
        () => {
          const command = withOutputStyleOption(withTuiOptions(argv));
          command.parseSync(['--tui=false']);
          expect(process.env.NX_TUI).toEqual('false');
        }
      ));
  });

  describe('withTuiOptions', () => {
    it('should parse tui flag', () => {
      const command = withTuiOptions(argv);
      const result = command.parseSync(['--tui']);
      expect(result.tui).toEqual(true);
    });

    it('should parse tui flag set to false', () => {
      const command = withTuiOptions(argv);
      const result = command.parseSync(['--tui=false']);
      expect(result.tui).toEqual(false);
    });

    it('should parse tuiAutoExit flag', () => {
      const command = withTuiOptions(argv);
      const result = command.parseSync(['--tuiAutoExit=5']);
      expect(result.tuiAutoExit).toEqual(5);
    });
  });
});

describe('readParallelFromArgsAndEnv', () => {
  it('default parallel should be 3', () => {
    const result = readParallelFromArgsAndEnv({ parallel: 'true' });
    expect(result).toEqual(3);
  });

  it('use maxParallel', () => {
    const result = readParallelFromArgsAndEnv({
      parallel: '',
      maxParallel: '4',
    });
    expect(result).toEqual(4);
  });

  it('use max-parallel', () => {
    const result = readParallelFromArgsAndEnv({
      parallel: '',
      'max-parallel': '5',
    });
    expect(result).toEqual(5);
  });

  it('should read parallel 6', () => {
    const result = readParallelFromArgsAndEnv({
      parallel: '6',
    });
    expect(result).toEqual(6);
  });

  it('0% parallel should be 1', () => {
    const result = readParallelFromArgsAndEnv({
      parallel: '0%',
    });
    expect(result).toEqual(1);
  });

  it('100% parallel should not be less than 1', () => {
    const result = readParallelFromArgsAndEnv({
      parallel: '100%',
    });
    expect(result).toBeGreaterThanOrEqual(1);
  });
});
