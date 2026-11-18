import type { Mock } from 'vitest';
import { readMinReleaseAgePolicy } from './policy';

vi.mock('../package-manager', () => ({
  detectPackageManager: vi.fn(),
  getPackageManagerVersion: vi.fn(),
}));
vi.mock('./behavior/npm', () => ({ readNpmPolicy: vi.fn() }));
vi.mock('./behavior/pnpm', () => ({ readPnpmPolicy: vi.fn() }));
vi.mock('./behavior/yarn', () => ({ readYarnPolicy: vi.fn() }));
vi.mock('./behavior/bun', () => ({ readBunPolicy: vi.fn() }));

import {
  detectPackageManager,
  getPackageManagerVersion,
} from '../package-manager';
import { readBunPolicy } from './behavior/bun';
import { readNpmPolicy } from './behavior/npm';
import { readPnpmPolicy } from './behavior/pnpm';
import { readYarnPolicy } from './behavior/yarn';

const detectMock = detectPackageManager as Mock;
const versionMock = getPackageManagerVersion as Mock;
const readers = {
  npm: readNpmPolicy as Mock,
  pnpm: readPnpmPolicy as Mock,
  yarn: readYarnPolicy as Mock,
  bun: readBunPolicy as Mock,
};

describe('readMinReleaseAgePolicy (dispatch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const reader of Object.values(readers)) {
      reader.mockResolvedValue({ outcome: 'inactive' });
    }
  });

  describe('introduction boundary', () => {
    it.each([
      ['npm', '11.9.0'],
      ['pnpm', '10.15.1'],
      ['yarn', '4.9.4'],
      ['bun', '1.2.0'],
    ])(
      'returns inactive without reading config when %s is below its introduction boundary',
      async (pm, version) => {
        detectMock.mockReturnValue(pm);
        versionMock.mockReturnValue(version);

        await expect(readMinReleaseAgePolicy('/root')).resolves.toEqual({
          outcome: 'inactive',
        });
        expect(readers[pm]).not.toHaveBeenCalled();
      }
    );

    it.each([
      ['npm', '11.10.0'],
      ['pnpm', '10.16.0'],
      ['yarn', '4.10.0'],
      ['bun', '1.3.0'],
    ])(
      'dispatches to the %s reader at exactly the introduction boundary',
      async (pm, version) => {
        detectMock.mockReturnValue(pm);
        versionMock.mockReturnValue(version);

        await readMinReleaseAgePolicy('/root');
        expect(readers[pm]).toHaveBeenCalledWith('/root', version);
      }
    );
  });

  it('is ambiguous when the package manager version cannot be determined', async () => {
    detectMock.mockReturnValue('pnpm');
    versionMock.mockImplementation(() => {
      throw new Error('no pnpm on PATH');
    });

    const result = await readMinReleaseAgePolicy('/root');
    expect(result).toEqual({
      outcome: 'ambiguous',
      reason: expect.stringContaining('Unable to determine the pnpm version'),
    });
    expect(readers.pnpm).not.toHaveBeenCalled();
  });

  it('is ambiguous when the detected version is not valid semver', async () => {
    detectMock.mockReturnValue('npm');
    versionMock.mockReturnValue('not-a-version');

    const result = await readMinReleaseAgePolicy('/root');
    expect(result).toEqual({
      outcome: 'ambiguous',
      reason: expect.stringContaining('Unable to parse the npm version'),
    });
    expect(readers.npm).not.toHaveBeenCalled();
  });

  it('returns the per-PM reader result verbatim', async () => {
    detectMock.mockReturnValue('npm');
    versionMock.mockReturnValue('11.16.0');
    const policy = { outcome: 'active', policy: { packageManager: 'npm' } };
    readers.npm.mockResolvedValue(policy);

    await expect(readMinReleaseAgePolicy('/root')).resolves.toBe(policy);
  });

  it('uses the latest known behavior for a newer minor within a known major', async () => {
    detectMock.mockReturnValue('pnpm');
    versionMock.mockReturnValue('11.99.0');

    await readMinReleaseAgePolicy('/root');
    expect(readers.pnpm).toHaveBeenCalledWith('/root', '11.99.0');
  });
});
