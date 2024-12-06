import * as stream from 'node:stream';
import * as yargs from 'yargs';

import {
  withAffectedOptions,
  withRunManyOptions,
  parseCSV,
} from './shared-options';

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
});
