import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Tree } from '../tree';
import {
  formatChangedFilesWithPrettierIfAvailable,
  formatFilesWithPrettierIfAvailable,
} from './format-changed-files-with-prettier-if-available';

describe('formatChangedFilesWithPrettierIfAvailable', () => {
  let originalSkipFormat: string | undefined;
  let root: string;

  beforeEach(() => {
    originalSkipFormat = process.env.NX_SKIP_FORMAT;
    delete process.env.NX_SKIP_FORMAT;
    root = mkdtempSync(join(tmpdir(), 'nx-prettier-'));
    mkdirSync(join(root, 'packages/my-lib'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ prettier: {} }));
  });

  afterEach(() => {
    if (originalSkipFormat === undefined) {
      delete process.env.NX_SKIP_FORMAT;
    } else {
      process.env.NX_SKIP_FORMAT = originalSkipFormat;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('does not format excluded paths given with Windows separators', async () => {
    const write = jest.fn();
    const tree = {
      root,
      listChanges: jest.fn(() => [
        {
          path: 'packages/my-lib/package.json',
          type: 'UPDATE' as const,
          content: Buffer.from('{"version":"1.1.0"}'),
        },
      ]),
      write,
    } as unknown as Tree;

    await formatChangedFilesWithPrettierIfAvailable(tree);
    expect(write).toHaveBeenCalledTimes(1);

    write.mockClear();
    await formatChangedFilesWithPrettierIfAvailable(tree, {
      excludePaths: new Set(['packages\\my-lib\\package.json']),
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('returns immediately when there are no files to format', async () => {
    await expect(formatFilesWithPrettierIfAvailable([], root)).resolves.toEqual(
      new Map()
    );
  });
});
