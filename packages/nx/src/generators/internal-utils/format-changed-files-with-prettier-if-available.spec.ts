import type { Tree } from '../tree';
import { formatChangedFilesWithPrettierIfAvailable } from './format-changed-files-with-prettier-if-available';

describe('formatChangedFilesWithPrettierIfAvailable', () => {
  it('does not format excluded files', async () => {
    const originalSkipFormat = process.env.NX_SKIP_FORMAT;
    delete process.env.NX_SKIP_FORMAT;
    const write = jest.fn();
    const listChanges = jest.fn(() => [
      {
        path: 'package.json',
        type: 'UPDATE' as const,
        content: Buffer.from('{"version":"1.1.0"}'),
      },
    ]);
    const tree = {
      root: process.cwd(),
      listChanges,
      write,
    } as unknown as Tree;

    try {
      await formatChangedFilesWithPrettierIfAvailable(tree, {
        excludePaths: new Set(['package.json']),
      });

      expect(listChanges).toHaveBeenCalledTimes(1);
      expect(write).not.toHaveBeenCalled();
    } finally {
      if (originalSkipFormat === undefined) {
        delete process.env.NX_SKIP_FORMAT;
      } else {
        process.env.NX_SKIP_FORMAT = originalSkipFormat;
      }
    }
  });
});
