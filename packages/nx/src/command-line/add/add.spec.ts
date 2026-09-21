vi.mock('child_process');
vi.mock('fs', () => ({ ...require('fs'), existsSync: vi.fn() }));
vi.mock('../../analytics', () => ({ reportNxAddCommand: vi.fn() }));
vi.mock('../../daemon/client/client', () => ({
  daemonClient: { stop: vi.fn() },
}));
vi.mock('../init/configure-plugins', () => ({
  runPluginInitGenerator: vi.fn(),
}));

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as configuration from '../../config/nx-json';
import * as packageManager from '../../utils/package-manager';
import { nxVersion } from '../../utils/versions';
import { addHandler, coreNxPluginVersions } from './add';

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
      expect(install.mock.calls[0][0]).toBe('pnpm add -Dw @nx/vite@21.6.4');
      expect(install.mock.calls[0][1].env.pnpm_config_strict_dep_builds).toBe(
        'false'
      );
      expect(
        install.mock.calls[0][1].env.PNPM_CONFIG_STRICT_DEP_BUILDS
      ).toBeUndefined();
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
