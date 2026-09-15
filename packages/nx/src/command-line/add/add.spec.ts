import { exec } from 'child_process';
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
