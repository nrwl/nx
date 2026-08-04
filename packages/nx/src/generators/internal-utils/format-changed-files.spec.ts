import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Tree } from '../tree';
import { formatChangedFiles } from './format-changed-files';

describe('formatChangedFiles', () => {
  let originalSkipFormat: string | undefined;
  let root: string;

  beforeEach(() => {
    originalSkipFormat = process.env.NX_SKIP_FORMAT;
    delete process.env.NX_SKIP_FORMAT;
    root = mkdtempSync(join(tmpdir(), 'nx-format-changed-'));
    mkdirSync(join(root, 'packages/my-lib'), { recursive: true });
    writeFileSync(join(root, '.oxfmtrc.json'), '{}');
  });

  afterEach(() => {
    if (originalSkipFormat === undefined) {
      delete process.env.NX_SKIP_FORMAT;
    } else {
      process.env.NX_SKIP_FORMAT = originalSkipFormat;
    }
    rmSync(root, { recursive: true, force: true });
  });

  // `nx release` passes the manifests it just wrote here so they keep the
  // formatting it chose. It builds those paths with the platform separator, so
  // on Windows the exclusion only lands if it is normalized first.
  it('does not format excluded paths given with Windows separators', async () => {
    const write = jest.fn();
    const tree = {
      root,
      exists: (path: string) => path === '.oxfmtrc.json',
      listChanges: jest.fn(() => [
        {
          path: 'packages/my-lib/package.json',
          type: 'UPDATE' as const,
          content: Buffer.from('{"version":"1.1.0"}'),
        },
      ]),
      write,
    } as unknown as Tree;

    await formatChangedFiles(tree);
    expect(write).toHaveBeenCalledTimes(1);

    write.mockClear();
    await formatChangedFiles(tree, {
      excludePaths: new Set(['packages\\my-lib\\package.json']),
    });

    expect(write).not.toHaveBeenCalled();
  });
});
