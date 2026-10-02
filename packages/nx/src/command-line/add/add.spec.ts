vi.mock('child_process');
vi.mock('fs', () => ({
  ...require('fs'),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));
vi.mock('../../analytics', () => ({ reportNxAddCommand: vi.fn() }));
vi.mock('../../daemon/client/client', () => ({
  daemonClient: { stop: vi.fn() },
}));
vi.mock('../init/configure-plugins', () => ({
  runPluginInitGenerator: vi.fn(),
}));
vi.mock('../../utils/acknowledge-build-scripts', () => ({
  acknowledgeDeclaredBuildScripts: vi.fn(),
}));

import * as childProcess from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import type { MockInstance } from 'vitest';
import * as configuration from '../../config/nx-json';
import { acknowledgeDeclaredBuildScripts } from '../../utils/acknowledge-build-scripts';
import * as packageManager from '../../utils/package-manager';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import { addHandler, coreNxPluginVersions, installPackage } from './add';

describe('nx add installation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(['11.0.0', '12.4.2'])(
    'disables strict build approvals for pnpm %s before plugin initialization',
    async (version) => {
      // pnpm 12 reads the uppercase form first, so it has to go.
      vi.stubEnv('PNPM_CONFIG_STRICT_DEP_BUILDS', 'true');
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(configuration, 'readNxJson').mockReturnValue({});
      vi.spyOn(packageManager, 'detectPackageManager').mockReturnValue('pnpm');
      vi.spyOn(packageManager, 'getPackageManagerVersion').mockReturnValue(
        version
      );
      vi.spyOn(packageManager, 'getPackageManagerCommand').mockReturnValue({
        addDev: 'pnpm add -Dw',
      } as any);
      const install = vi.spyOn(childProcess, 'exec').mockImplementation(((
        command,
        options,
        callback
      ) => {
        callback(null, '', '');
      }) as any);

      expect(
        await addHandler({
          packageSpecifier: '@nx/vite@21.6.4',
          verbose: false,
        })
      ).toBe(0);
      expect(install.mock.calls[0][0]).toBe(
        'pnpm add -Dw @nx/vite@21.6.4 --config.strictDepBuilds=false'
      );
      expect(install.mock.calls[0][1].env.PNPM_CONFIG_STRICT_DEP_BUILDS).toBe(
        'false'
      );
    }
  );
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
  const pnpmWorkspacePath = join(workspaceRoot, 'pnpm-workspace.yaml');
  let install: MockInstance;

  beforeEach(() => {
    vi.stubEnv('PNPM_CONFIG_STRICT_DEP_BUILDS', 'true');
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(packageManager, 'detectPackageManager').mockReturnValue('pnpm');
    vi.spyOn(packageManager, 'getPackageManagerVersion').mockReturnValue(
      '11.0.0'
    );
    vi.spyOn(packageManager, 'getPackageManagerCommand').mockReturnValue({
      addDev: 'pnpm add -D',
    } as any);
    install = vi
      .spyOn(childProcess, 'exec')
      .mockImplementation(((_command, _options, callback) =>
        callback(null, '', '')) as any);
    install.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.mocked(fs.writeFileSync).mockClear();
    vi.mocked(fs.rmSync).mockClear();
  });

  function failInstall() {
    install.mockImplementation(((_command, _options, callback) =>
      callback(new Error('boom'), '', 'ERR_PNPM_PEER_DEP_ISSUES')) as any);
    return vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as any);
  }

  it('should keep the install strict when the plugin declares its build-script decisions', async () => {
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);

    await installPackage('@org/plugin', '1.0.0', {});

    expect(acknowledgeDeclaredBuildScripts).toHaveBeenCalledWith(
      workspaceRoot,
      'pnpm',
      '@org/plugin',
      '1.0.0'
    );
    expect(install.mock.calls[0][0]).toBe('pnpm add -D @org/plugin@1.0.0');
    expect(install.mock.calls[0][1].env.PNPM_CONFIG_STRICT_DEP_BUILDS).toBe(
      'true'
    );
  });

  it('should skip unreviewed build scripts for this install when the plugin declares nothing', async () => {
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(false);

    await installPackage('@org/plugin', 'latest', {});

    expect(install.mock.calls[0][0]).toBe(
      'pnpm add -D @org/plugin@latest --config.strictDepBuilds=false'
    );
    expect(install.mock.calls[0][1].env.PNPM_CONFIG_STRICT_DEP_BUILDS).toBe(
      'false'
    );
  });

  it('should leave pnpm-workspace.yaml alone when the install succeeds', async () => {
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);

    await installPackage('@org/plugin', '1.0.0', {});

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it('should restore pnpm-workspace.yaml when the install fails after decisions were recorded', async () => {
    const before = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);
    const exit = failInstall();

    await expect(installPackage('@org/plugin', '1.0.0', {})).rejects.toThrow(
      'exit'
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(pnpmWorkspacePath, before);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should remove the pnpm-workspace.yaml that recording created when the install fails', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (file) => file !== pnpmWorkspacePath
    );
    vi.mocked(acknowledgeDeclaredBuildScripts).mockResolvedValueOnce(true);
    failInstall();

    await expect(installPackage('@org/plugin', '1.0.0', {})).rejects.toThrow(
      'exit'
    );

    expect(fs.rmSync).toHaveBeenCalledWith(pnpmWorkspacePath, { force: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
