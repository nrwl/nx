import { exec } from 'child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { acknowledgeDeclaredBuildScripts } from '../../utils/acknowledge-build-scripts';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import { coreNxPluginVersions, installPackage } from './add';

vi.mock('child_process', async () => ({
  ...(await vi.importActual('child_process')),
  exec: vi.fn((_command, _options, callback) => callback(null, '', '')),
}));
vi.mock('../../utils/package-manager', async () => ({
  ...(await vi.importActual('../../utils/package-manager')),
  detectPackageManager: () => 'pnpm',
  getPackageManagerVersion: () => '11.0.0',
  getPackageManagerCommand: () => ({ addDev: 'pnpm add -D' }),
}));
vi.mock('../../utils/acknowledge-build-scripts', () => ({
  acknowledgeDeclaredBuildScripts: vi.fn(),
}));
vi.mock('../../utils/spinner', () => ({
  globalSpinner: { start: () => ({ succeed: () => {}, fail: () => {} }) },
}));
vi.mock('../../utils/logger', () => ({ logger: { error: () => {} } }));
vi.mock('../../utils/output', () => ({
  output: { addNewline: () => {}, error: () => {}, success: () => {} },
}));
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

describe('nx core packages', () => {
  it('should map nx packages to nx version', () => {
    expect(coreNxPluginVersions.get('@nx/workspace')).toEqual(nxVersion);
  });

  it('should map nx-cloud to latest', () => {
    expect(coreNxPluginVersions.get('@nrwl/nx-cloud')).toEqual('latest');
    expect(coreNxPluginVersions.get('nx-cloud')).toEqual('latest');
  });
});

describe('installPackage', () => {
  beforeEach(() => {
    vi.mocked(exec).mockClear();
    vi.mocked(writeFileSync).mockClear();
    vi.mocked(rmSync).mockClear();
  });

  it('should keep the install strict when the plugin declares its build-script decisions', async () => {
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);

    await installPackage('@org/plugin', '1.0.0', {});

    expect(acknowledgeDeclaredBuildScripts).toHaveBeenCalledWith(
      workspaceRoot,
      'pnpm',
      '@org/plugin',
      '1.0.0'
    );
    expect(exec).toHaveBeenCalledWith(
      'pnpm add -D @org/plugin@1.0.0',
      expect.anything(),
      expect.any(Function)
    );
  });

  it('should leave pnpm-workspace.yaml alone when the install succeeds', async () => {
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);

    await installPackage('@org/plugin', '1.0.0', {});

    expect(writeFileSync).not.toHaveBeenCalled();
    expect(rmSync).not.toHaveBeenCalled();
  });

  it('should restore pnpm-workspace.yaml when the install fails after decisions were recorded', async () => {
    const pnpmWorkspacePath = join(workspaceRoot, 'pnpm-workspace.yaml');
    const before = readFileSync(pnpmWorkspacePath, 'utf-8');
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);
    vi.mocked(exec).mockImplementationOnce((_command, _options, callback) =>
      callback(new Error('boom'), '', 'ERR_PNPM_PEER_DEP_ISSUES')
    );
    const exit = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
      throw new Error('exit');
    });

    await expect(installPackage('@org/plugin', '1.0.0', {})).rejects.toThrow(
      'exit'
    );

    expect(writeFileSync).toHaveBeenCalledWith(pnpmWorkspacePath, before);
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
  });

  it('should remove the pnpm-workspace.yaml that recording created when the install fails', async () => {
    const pnpmWorkspacePath = join(workspaceRoot, 'pnpm-workspace.yaml');
    const actualExistsSync = (await vi.importActual<typeof import('fs')>('fs'))
      .existsSync;
    vi.mocked(existsSync).mockImplementation((file) =>
      file === pnpmWorkspacePath ? false : actualExistsSync(file)
    );
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);
    vi.mocked(exec).mockImplementationOnce((_command, _options, callback) =>
      callback(new Error('boom'), '', '')
    );
    const exit = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
      throw new Error('exit');
    });

    await expect(installPackage('@org/plugin', '1.0.0', {})).rejects.toThrow(
      'exit'
    );

    expect(rmSync).toHaveBeenCalledWith(pnpmWorkspacePath, { force: true });
    expect(writeFileSync).not.toHaveBeenCalled();
    vi.mocked(existsSync).mockImplementation(actualExistsSync);
    exit.mockRestore();
  });

  it('should skip unreviewed build scripts for this install when the plugin declares nothing', async () => {
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(false);

    await installPackage('@org/plugin', 'latest', {});

    expect(exec).toHaveBeenCalledWith(
      'pnpm add -D @org/plugin@latest --config.strictDepBuilds=false',
      expect.anything(),
      expect.any(Function)
    );
  });
});
