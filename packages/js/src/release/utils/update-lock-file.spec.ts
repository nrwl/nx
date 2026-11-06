import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { detectPackageManager, isWorkspacesEnabled } from '@nx/devkit';
import { updateLockFile } from './update-lock-file';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  execSync: vi.fn(() => ''),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  detectPackageManager: vi.fn(),
  isWorkspacesEnabled: vi.fn(),
  getPackageManagerVersion: vi.fn(() => '10.0.0'),
  output: { logSingleLine: vi.fn(), error: vi.fn() },
}));

vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  daemonClient: { enabled: vi.fn(() => false) },
}));

describe('updateLockFile', () => {
  let cwd: string;

  function writeWorkspaceFiles(
    packageJsonVersion: string | undefined,
    lockFileRootVersion: string | undefined
  ) {
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'root-pkg', version: packageJsonVersion })
    );
    writeFileSync(
      join(cwd, 'package-lock.json'),
      JSON.stringify({
        name: 'root-pkg',
        version: lockFileRootVersion,
        lockfileVersion: 3,
        packages: { '': { name: 'root-pkg', version: lockFileRootVersion } },
      })
    );
  }

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'update-lock-file-'));
    vi.mocked(detectPackageManager).mockReturnValue('npm');
    vi.mocked(isWorkspacesEnabled).mockReturnValue(false);
    vi.mocked(execSync).mockClear();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('updates the npm lock file without workspaces when the root version in the lock file is stale', async () => {
    writeWorkspaceFiles('1.1.0', '1.0.0');

    const changedFiles = await updateLockFile(cwd, {});

    expect(execSync).toHaveBeenCalledWith(
      'npm install --package-lock-only',
      expect.objectContaining({ cwd })
    );
    expect(changedFiles).toContain('package-lock.json');
  });

  it('skips the npm lock file update without workspaces when the root version is already in sync', async () => {
    writeWorkspaceFiles('1.0.0', '1.0.0');

    const changedFiles = await updateLockFile(cwd, {});

    expect(execSync).not.toHaveBeenCalled();
    expect(changedFiles).toEqual([]);
  });

  it('skips the npm lock file update without workspaces when the root package has no version', async () => {
    writeWorkspaceFiles(undefined, undefined);

    const changedFiles = await updateLockFile(cwd, {});

    expect(execSync).not.toHaveBeenCalled();
    expect(changedFiles).toEqual([]);
  });

  it('does not create an npm lock file when none exists', async () => {
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'root-pkg', version: '1.1.0' })
    );

    const changedFiles = await updateLockFile(cwd, {});

    expect(execSync).not.toHaveBeenCalled();
    expect(changedFiles).toEqual([]);
  });

  it('keeps skipping the lock file update without workspaces for other package managers', async () => {
    vi.mocked(detectPackageManager).mockReturnValue('pnpm');
    writeWorkspaceFiles('1.1.0', '1.0.0');

    const changedFiles = await updateLockFile(cwd, {});

    expect(execSync).not.toHaveBeenCalled();
    expect(changedFiles).toEqual([]);
  });
});
