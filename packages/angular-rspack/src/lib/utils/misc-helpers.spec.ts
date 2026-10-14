import { readModulePackageJson } from '@nx/devkit/internal';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInstalledPackageVersionFromRoot } from './misc-helpers';

// The real helper pulls in nx's native bindings, which this suite cannot load.
vi.mock('@nx/devkit/internal', () => ({ readModulePackageJson: vi.fn() }));

describe('getInstalledPackageVersionFromRoot', () => {
  beforeEach(() => {
    vi.mocked(readModulePackageJson).mockReset();
  });

  it('returns the version from the package.json found from the root', () => {
    vi.mocked(readModulePackageJson).mockReturnValue({
      packageJson: { name: 'fixture-package', version: '21.2.0' },
      path: '/workspace/node_modules/fixture-package/package.json',
    });

    expect(
      getInstalledPackageVersionFromRoot('/workspace', 'fixture-package')
    ).toBe('21.2.0');
    expect(readModulePackageJson).toHaveBeenCalledWith('fixture-package', [
      '/workspace',
    ]);
  });

  it('returns null when the package is not installed', () => {
    vi.mocked(readModulePackageJson).mockImplementation(() => {
      throw Object.assign(new Error("Cannot find module 'fixture-package'"), {
        code: 'MODULE_NOT_FOUND',
      });
    });

    expect(
      getInstalledPackageVersionFromRoot('/workspace', 'fixture-package')
    ).toBeNull();
  });
});
