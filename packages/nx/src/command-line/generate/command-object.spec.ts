import * as yargs from 'yargs';

import { withGenerateOptions } from './command-object';

const argv = yargs.default([]);

describe('command-object', () => {
  describe('yargsGenerateCommand', () => {
    const command = withGenerateOptions(argv);

    it('should parse files to array', () => {
      const result = command.parseSync([
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
  });
});
