import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const dirs = vi.hoisted(() => {
  const fs = require('node:fs') as typeof import('node:fs');
  const os = require('node:os') as typeof import('node:os');
  const path = require('node:path') as typeof import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-reset-cache-'));
  return {
    root,
    cache: path.join(root, 'shared'),
    checkout: path.join(root, 'checkout-cache'),
    outside: path.join(root, 'outside'),
    workspaceData: path.join(root, 'workspace-data'),
  };
});

vi.mock('../../nx-cloud/utilities/client', () => ({
  getCloudClient: vi.fn(),
}));
vi.mock('../../nx-cloud/utilities/get-cloud-options', () => ({
  getCloudOptions: () => ({}),
}));
vi.mock('../../nx-cloud/update-manager', () => ({
  getBundleInstallDefaultLocation: () => dirs.root,
}));
vi.mock('../../utils/nx-cloud-utils', () => ({ isNxCloudUsed: () => false }));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../daemon/client/client', () => ({
  daemonClient: { enabled: () => false },
}));
vi.mock('../../daemon/tmp-dir', () => ({
  DAEMON_DIR_FOR_CURRENT_WORKSPACE: dirs.root,
}));
vi.mock('../../native/native-file-cache-location', () => ({
  getNativeFileCacheLocationToDelete: () => null,
}));
vi.mock('../../utils/workspace-root', () => ({ workspaceRoot: dirs.root }));
vi.mock('../../utils/cache-directory', () => ({
  cacheDir: dirs.cache,
  workspaceDataDirectory: dirs.workspaceData,
  cacheDirectoryForWorkspace: () => dirs.checkout,
  sharedDataDirectory: () => dirs.workspaceData,
}));

import { output } from '../../utils/output';
import { resetHandler } from './reset';

describe('nx reset cache entries', () => {
  const hashDir = '8178534859406215051';

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as never);
    vi.spyOn(output, 'error').mockImplementation(() => {});
    vi.spyOn(output, 'success').mockImplementation(() => {});
    vi.spyOn(output, 'note').mockImplementation(() => {});

    rmSync(dirs.cache, { recursive: true, force: true });
    rmSync(dirs.checkout, { recursive: true, force: true });
    rmSync(dirs.outside, { recursive: true, force: true });
    mkdirSync(dirs.outside, { recursive: true });
    writeFileSync(join(dirs.outside, 'secret.txt'), 'leave this');
    populate(dirs.cache);
    populate(dirs.checkout);
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(() => rmSync(dirs.root, { recursive: true, force: true }));

  it('removes Nx cache entries and leaves the directory and unrelated files', async () => {
    symlinkSync(dirs.outside, join(dirs.cache, 'terminalOutputs'));
    symlinkSync(dirs.outside, join(dirs.cache, 'my-link'));

    await resetHandler({ onlyCache: true });

    expect(existsSync(dirs.cache)).toBe(true);
    expect(lstatSync(dirs.cache).isDirectory()).toBe(true);
    expect(readdirSync(dirs.cache).sort()).toEqual(
      [
        '123456789012345',
        'NOTES.md',
        'backup.tar.zst',
        'my-link',
        'other.db',
        'tools',
        'yarn.lock',
      ].sort()
    );
    expect(readFileSync(join(dirs.cache, 'NOTES.md'), 'utf-8')).toBe('keep');
    expect(readFileSync(join(dirs.cache, 'other.db'), 'utf-8')).toBe('keep');
    expect(readFileSync(join(dirs.cache, 'tools', 'run.json'), 'utf-8')).toBe(
      'keep'
    );
    expect(readFileSync(join(dirs.cache, 'tools', hashDir), 'utf-8')).toBe(
      'keep'
    );
    expect(existsSync(join(dirs.outside, 'secret.txt'))).toBe(true);
    expect(readFileSync(join(dirs.outside, 'secret.txt'), 'utf-8')).toBe(
      'leave this'
    );

    expect(existsSync(dirs.checkout)).toBe(true);
    expect(readdirSync(dirs.checkout).sort()).toEqual(
      [
        '123456789012345',
        'NOTES.md',
        'backup.tar.zst',
        'other.db',
        'tools',
        'yarn.lock',
      ].sort()
    );
  });
});

function populate(dir: string) {
  const hashDir = '8178534859406215051';
  const db = '550e8400-e29b-41d4-a716-446655440000-v6';

  mkdirSync(join(dir, hashDir, 'dist'), { recursive: true });
  writeFileSync(join(dir, hashDir, 'dist', 'main.js'), 'built');
  mkdirSync(join(dir, '42'));
  mkdirSync(join(dir, 'fe335a9bedb86773'));
  mkdirSync(join(dir, 'batchOutputs'), { recursive: true });
  writeFileSync(join(dir, 'batchOutputs', 'batch.log'), 'log');
  writeFileSync(join(dir, 'run.json'), '{}');
  writeFileSync(join(dir, `${hashDir}.commit`), 'true');
  writeFileSync(join(dir, 'fe335a9bedb86773.tar.zst'), 'archive');
  writeFileSync(join(dir, `${db}.db`), 'db');
  writeFileSync(join(dir, `${db}.db-wal`), 'wal');
  writeFileSync(join(dir, `${db}.db-shm`), 'shm');
  writeFileSync(join(dir, `${db}.db-journal`), 'journal');
  writeFileSync(join(dir, `${db}.lock`), 'lock');
  writeFileSync(join(dir, '.nx-write-probe-abcdef0123456789'), '');

  writeFileSync(join(dir, 'NOTES.md'), 'keep');
  writeFileSync(join(dir, 'other.db'), 'keep');
  writeFileSync(join(dir, 'backup.tar.zst'), 'keep');
  writeFileSync(join(dir, 'yarn.lock'), 'keep');
  writeFileSync(join(dir, '123456789012345'), 'keep');
  mkdirSync(join(dir, 'tools'));
  writeFileSync(join(dir, 'tools', 'run.json'), 'keep');
  writeFileSync(join(dir, 'tools', hashDir), 'keep');
}
