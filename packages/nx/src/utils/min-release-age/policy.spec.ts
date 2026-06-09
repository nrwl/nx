import { readMinReleaseAgePolicy } from './policy';

jest.mock('../package-manager', () => ({
  detectPackageManager: jest.fn(),
  getPackageManagerVersion: jest.fn(),
}));
jest.mock('./behavior/npm', () => ({ readNpmPolicy: jest.fn() }));
jest.mock('./behavior/pnpm', () => ({ readPnpmPolicy: jest.fn() }));
jest.mock('./behavior/yarn', () => ({ readYarnPolicy: jest.fn() }));
jest.mock('./behavior/bun', () => ({ readBunPolicy: jest.fn() }));

import {
  detectPackageManager,
  getPackageManagerVersion,
} from '../package-manager';
import { readBunPolicy } from './behavior/bun';
import { readNpmPolicy } from './behavior/npm';
import { readPnpmPolicy } from './behavior/pnpm';
import { readYarnPolicy } from './behavior/yarn';

const detectMock = detectPackageManager as jest.Mock;
const versionMock = getPackageManagerVersion as jest.Mock;
const readers = {
  npm: readNpmPolicy as jest.Mock,
  pnpm: readPnpmPolicy as jest.Mock,
  yarn: readYarnPolicy as jest.Mock,
  bun: readBunPolicy as jest.Mock,
};

describe('readMinReleaseAgePolicy (dispatch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
