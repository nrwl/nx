import { readModulePackageJson } from '@nx/devkit/internal';
import { describe, expect, it, vi } from 'vitest';
import { getInstalledPackageVersionFromRoot } from './misc-helpers';

vi.mock('@nx/devkit/internal', () => ({ readModulePackageJson: vi.fn() }));

describe('getInstalledPackageVersionFromRoot', () => {
  it('returns the version from the package.json readModulePackageJson reads', () => {
    vi.mocked(readModulePackageJson).mockReturnValue({
      packageJson: { name: 'fixture-package', version: '21.2.0' },
      path: '/workspace/node_modules/fixture-package/package.json',
    });

    expect(
      getInstalledPackageVersionFromRoot('/workspace', 'fixture-package')
    ).toBe('21.2.0');
  });
});
