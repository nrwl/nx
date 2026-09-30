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
    const write = vi.fn();
    const tree = {
      root,
      exists: (path: string) => path === '.oxfmtrc.json',
      // The ignore chain is read through the tree now; this workspace has no
      // ignore files, so every lookup misses.
      read: () => null,
      listChanges: vi.fn(() => [
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

  // The batch is selected against the tree, so the backend has to re-check
  // against the tree too. Reading disk here would still see the rule the
  // generator just removed, and silently skip a file it was asked to format.
  it('formats a file whose ignore rule the tree removed', async () => {
    writeFileSync(join(root, '.gitignore'), 'packages/my-lib/a.ts\n');
    const write = vi.fn();
    const tree = {
      root,
      exists: (path: string) => path === '.oxfmtrc.json',
      // The tree's .gitignore no longer carries the rule that disk still has.
      read: (path: string) => (path === '.gitignore' ? '' : null),
      listChanges: vi.fn(() => [
        {
          path: 'packages/my-lib/a.ts',
          type: 'UPDATE' as const,
          content: Buffer.from('const   x  =  1\n'),
        },
      ]),
      write,
    } as unknown as Tree;

    await formatChangedFiles(tree);

    expect(write).toHaveBeenCalledTimes(1);
  });

  // Detection accepts a formatter declared in the root package.json, so prettier
  // can be selected without being configured. devkit's `formatFiles` formats that
  // workspace on prettier's defaults; this path used to skip it, so `nx release`
  // and devkit disagreed about the same workspace.
  it('formats on prettier defaults when prettier is declared but not configured', async () => {
    const packageJson = JSON.stringify({
      devDependencies: { prettier: '^3.6.2' },
    });
    const write = vi.fn();
    const tree = {
      root,
      exists: (path: string) => path === 'package.json',
      read: (path: string) =>
        path === 'package.json' ? Buffer.from(packageJson) : null,
      listChanges: vi.fn(() => [
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
    // Prettier's own defaults, with no config anywhere - the same single-line to
    // multi-line expansion #30403 reported.
    expect(write.mock.calls[0][1]).toEqual('{\n  "version": "1.1.0"\n}\n');
  });
});
