import { join } from 'path';
import { tmpdir } from 'os';
import { diskWalkSkippedDirectories } from './disk-walk-skipped-directories';

describe('diskWalkSkippedDirectories', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('keeps the cache and workspace-data directories that sit inside the workspace', () => {
    const root = join(tmpdir(), 'disk-walk-skips-ws');
    process.env.NX_CACHE_DIRECTORY = join(root, 'tmp', 'nx-cache');
    process.env.NX_WORKSPACE_DATA_DIRECTORY = join(tmpdir(), 'elsewhere');
    expect(diskWalkSkippedDirectories(root)).toEqual(['tmp/nx-cache']);
  });

  it('omits the default locations the walker already skips', () => {
    const root = join(tmpdir(), 'disk-walk-skips-ws');
    delete process.env.NX_CACHE_DIRECTORY;
    delete process.env.NX_WORKSPACE_DATA_DIRECTORY;
    delete process.env.NX_PROJECT_GRAPH_CACHE_DIRECTORY;
    expect(diskWalkSkippedDirectories(root)).toEqual([]);
  });

  it('keeps a directory whose name starts with two dots', () => {
    const root = join(tmpdir(), 'disk-walk-skips-ws');
    process.env.NX_CACHE_DIRECTORY = join(root, '..cache');
    process.env.NX_WORKSPACE_DATA_DIRECTORY = join(root, '..', 'outside');
    expect(diskWalkSkippedDirectories(root)).toEqual(['..cache']);
  });
});
