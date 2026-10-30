import type { Mock } from 'vitest';
import type { Options } from './types';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

vi.mock('../../../../utils/fileutils', async () => ({
  ...(await vi.importActual('../../../../utils/fileutils')),
  readJsonFile: vi.fn(() => ({})),
  writeJsonFile: vi.fn(),
}));

vi.mock('../../../../utils/output', () => ({
  output: { log: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../utils/package-json', () => ({
  readModulePackageJson: vi.fn(),
}));

vi.mock('../../../../utils/package-manager', () => ({
  getPackageManagerCommand: vi.fn(() => ({
    install: 'npm install',
    exec: 'npx',
  })),
  resolvePackageVersionUsingRegistry: vi.fn(),
  resolvePackageVersionUsingInstallation: vi.fn(),
}));

vi.mock('../../../../utils/provenance', () => ({
  ensurePackageHasProvenance: vi.fn(),
}));

vi.mock('../../../nx-cloud/connect/connect-to-nx-cloud', () => ({
  connectExistingRepoToNxCloudPrompt: vi.fn(),
}));

vi.mock('../utils', () => ({ initCloud: vi.fn() }));

vi.mock('../format', () => ({ recordInitWrite: vi.fn() }));

import { execSync } from 'child_process';
import { writeJsonFile } from '../../../../utils/fileutils';
import { readModulePackageJson } from '../../../../utils/package-json';
import {
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
} from '../../../../utils/package-manager';
import { ensurePackageHasProvenance } from '../../../../utils/provenance';
import { getLegacyMigrationFunctionIfApplicable } from './legacy-angular-versions';

describe('getLegacyMigrationFunctionIfApplicable', () => {
  const options = { integrated: false, interactive: false } as Options;

  function setAngularVersion(version: string) {
    (readModulePackageJson as Mock).mockReturnValue({
      packageJson: { version },
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should verify the provenance of the nx packages it installs and runs', async () => {
    setAngularVersion('19.2.0');
    (resolvePackageVersionUsingRegistry as Mock).mockResolvedValue('23.0.2');

    const migrate = await getLegacyMigrationFunctionIfApplicable(
      '/root',
      options
    );
    await migrate();

    expect((ensurePackageHasProvenance as Mock).mock.calls).toEqual([
      ['nx', '23.0.2'],
      ['@nx/workspace', '23.0.2'],
      ['@nx/angular', '23.0.2'],
    ]);
    expect(execSync).toHaveBeenCalledWith(
      'npx nx@23.0.2 init ' + process.argv.slice(2).join(' '),
      expect.anything()
    );
  });

  it('should not install or run nx when its provenance cannot be verified', async () => {
    setAngularVersion('19.2.0');
    (resolvePackageVersionUsingRegistry as Mock).mockResolvedValue('23.0.99');
    (ensurePackageHasProvenance as Mock).mockRejectedValue(
      new Error('No attestation URL found')
    );

    await expect(
      getLegacyMigrationFunctionIfApplicable('/root', options)
    ).rejects.toThrow('No attestation URL found');

    expect(writeJsonFile).not.toHaveBeenCalled();
    expect(execSync).not.toHaveBeenCalled();
  });

  it('should not fall back to installing nx when the registry lookup fails', async () => {
    setAngularVersion('19.2.0');
    (resolvePackageVersionUsingRegistry as Mock).mockRejectedValue(
      new Error('registry unavailable')
    );

    await expect(
      getLegacyMigrationFunctionIfApplicable('/root', options)
    ).rejects.toThrow('registry unavailable');

    expect(resolvePackageVersionUsingInstallation).not.toHaveBeenCalled();
    expect(execSync).not.toHaveBeenCalled();
  });
});
