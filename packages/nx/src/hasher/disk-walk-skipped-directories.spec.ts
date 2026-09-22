import { join } from 'path';

const dirs = vi.hoisted(() => ({ cache: '', data: '' }));
vi.mock('../utils/cache-directory', () => ({
  cacheDirectoryForWorkspace: () => dirs.cache,
  workspaceDataDirectoryForWorkspace: () => dirs.data,
}));

import { diskWalkSkippedDirectories } from './disk-walk-skipped-directories';

describe('diskWalkSkippedDirectories', () => {
  const root = join('/', 'w');

  it('is empty at the default spots, which the walker skips anyway', () => {
    dirs.cache = join(root, '.nx', 'cache');
    dirs.data = join(root, '.nx', 'workspace-data');
    expect(diskWalkSkippedDirectories(root)).toEqual([]);
  });

  it('names a relocated directory, workspace-relative with forward slashes', () => {
    dirs.cache = join(root, 'tmp', 'nx-cache');
    dirs.data = join(root, 'tmp', 'nx-data');
    expect(diskWalkSkippedDirectories(root)).toEqual([
      'tmp/nx-cache',
      'tmp/nx-data',
    ]);
  });

  // No walk reaches outside the workspace, so naming it would only widen the
  // list a walk has to check per directory.
  it('leaves out a directory outside the workspace', () => {
    dirs.cache = join('/', 'var', 'tmp', 'nx-cache');
    dirs.data = join(root, 'tmp', 'nx-data');
    expect(diskWalkSkippedDirectories(root)).toEqual(['tmp/nx-data']);
  });
});
