jest.mock('child_process');
// detectSurfaces reads os.homedir() and the .npmrc files through named imports
// bound at module load, so a per-test jest.spyOn never intercepts them. Mock at
// module scope (as yarn.spec.ts does for os) so the host's real ~/.npmrc cannot
// leak into the config-surface attribution tests.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/home/user'),
}));
jest.mock('../npmrc', () => ({ readNpmrcEntries: jest.fn(() => null) }));

import * as childProcess from 'child_process';
import { MinReleaseAgeViolationError } from '../errors';
import { readNpmrcEntries } from '../npmrc';
import type { RegistryMetadata } from '../packument';
import type { MinReleaseAgePolicy } from '../policy';
import { pickNpmVersion, readNpmPolicy } from './npm';

// Mirrors readNpmrcEntries parsing so the mocked surface map (path -> contents)
// drives detectSurfaces; an absent path reads as a missing file (null).
function parseNpmrcEntries(
  raw: string | undefined
): { key: string; value: string }[] | null {
  if (raw === undefined) {
    return null;
  }
  const entries: { key: string; value: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    entries.push({
      key: trimmed.slice(0, eq).trim(),
      value: trimmed.slice(eq + 1).trim(),
    });
  }
  return entries;
}

const HOUR = 3_600_000;
const NOW = Date.parse('2026-06-05T00:00:00.000Z');

// Mirrors the empirical pkg-a fixture (ages in hours at request time).
const PKG_A_AGES: Record<string, number> = {
  '1.0.0': 9600,
  '1.0.1': 840,
  '1.1.0': 240,
  '1.1.1': 72,
  '1.2.0': 25,
  '1.2.1': 12,
  '2.0.0': 6,
  '3.0.0-canary.1': 120,
  '3.0.0-canary.2': 20,
  '3.0.0-canary.3': 2,
  '3.0.0-beta.1': 96,
};

function metadataFromAges(
  name: string,
  ages: Record<string, number>,
  distTags: Record<string, string>,
  opts: { omitTimeMap?: boolean; omitTimeFor?: string[] } = {}
): RegistryMetadata {
  const time: Record<string, string> = {};
  for (const [version, ageHours] of Object.entries(ages)) {
    if (opts.omitTimeFor?.includes(version)) {
      continue;
    }
    time[version] = new Date(NOW - ageHours * HOUR).toISOString();
  }
  return {
    name,
    versions: Object.keys(ages),
    time: opts.omitTimeMap ? null : time,
    distTags,
  };
}

const pkgA = metadataFromAges('pkg-a', PKG_A_AGES, {
  latest: '2.0.0',
  hot: '2.0.0',
  'stable-old': '1.0.1',
  canary: '3.0.0-canary.3',
  beta: '3.0.0-beta.1',
});

const pkgB = metadataFromAges(
  'pkg-b',
  { '1.0.0': 10, '1.0.1': 2 },
  { latest: '1.0.1' }
);

const pkgEdge = metadataFromAges(
  'pkg-edge',
  { '1.0.0': 24.2, '1.0.1': 23.8 },
  { latest: '1.0.1' }
);

// Multiple prerelease channels sharing a release line, for the channel-aware
// tag degrade: an `rc` next-target with an internal `pr` build and a `beta` of
// the same line, plus an older cross-line `rc` and a same-line older `rc`.
const pkgChannels = metadataFromAges(
  'pkg-ch',
  {
    '22.7.0': 200,
    '22.7.5': 6,
    '22.7.0-rc.2': 220,
    '23.0.0-beta.1': 100,
    '23.0.0-pr.5': 90,
    '23.0.0-rc.0': 2,
    '23.1.0-rc.1': 80,
    '23.1.0-rc.4': 4,
  },
  { latest: '22.7.5', next: '23.0.0-rc.0', pre: '23.1.0-rc.4' }
);

// 24h window policy anchored to the fixture clock.
function policyWithWindow(windowHours: number): MinReleaseAgePolicy {
  const windowMs = windowHours * HOUR;
  return {
    packageManagerVersion: '11.16.0',
    cutoffMs: NOW - windowMs,
    windowMs,
    sourceDescription: `npm min-release-age (${windowHours / 24} days)`,
    isExcluded: () => false,
    behavior: { packageManager: 'npm' },
  };
}

function policyWithExcludes(
  windowHours: number,
  excluded: (name: string, version: string) => boolean
): MinReleaseAgePolicy {
  return { ...policyWithWindow(windowHours), isExcluded: excluded };
}

describe('npm min-release-age behavior', () => {
  describe('pickNpmVersion (24h window)', () => {
    const policy = policyWithWindow(24);

    it('exact mature pin passes through', () => {
      expect(pickNpmVersion('1.1.1', pkgA, policy)).toEqual({
        version: '1.1.1',
        unconstrained: '1.1.1',
      });
    });

    it('exact too-new pin -> ETARGET violation', () => {
      expect(() => pickNpmVersion('2.0.0', pkgA, policy)).toThrow(
        MinReleaseAgeViolationError
      );
      try {
        pickNpmVersion('2.0.0', pkgA, policy);
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toContain(
          'No matching version found for pkg-a@2.0.0 with a date before'
        );
      }
    });

    it('exact pin to an unpublished version -> ETARGET violation', () => {
      // npm-pick-manifest resolves `versions[ver]` -> undefined and throws
      // ETARGET; a missing time must not be treated as mature here.
      try {
        pickNpmVersion('9.9.9', pkgA, policy);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toContain(
          'No matching version found for pkg-a@9.9.9 with a date before'
        );
      }
    });

    it('exact pin present only in the time map -> ETARGET (unpublished)', () => {
      // An unpublished version lingers in `time` but is gone from `versions`;
      // `versions` is the source of truth, so a `time` entry alone must not
      // make it resolvable even when it is mature by age.
      const meta: RegistryMetadata = {
        name: 'pkg-a',
        versions: ['1.0.0'],
        time: {
          '1.0.0': new Date(NOW - 9600 * HOUR).toISOString(),
          '2.0.0': new Date(NOW - 9600 * HOUR).toISOString(),
        },
        distTags: { latest: '1.0.0' },
      };
      expect(() => pickNpmVersion('2.0.0', meta, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });

    it('range with mature survivors but none in range -> ETARGET violation', () => {
      // ^5.0.0 has no matching version (pkg-a tops out at 3.x); mature 1.x
      // survivors exist, so this is the inRange-empty ETARGET path, not ENOVERSIONS.
      try {
        pickNpmVersion('^5.0.0', pkgA, policy);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          `No matching version found for pkg-a@^5.0.0 with a date before ${new Date(
            policy.cutoffMs
          ).toLocaleString()}.`
        );
      }
    });

    it('range degrades to the newest mature survivor (^1 -> 1.2.0)', () => {
      // ^1.0.0 is >=1.0.0 <2.0.0; unconstrained newest is 1.2.1, mature is 1.2.0.
      expect(pickNpmVersion('^1.0.0', pkgA, policy)).toEqual({
        version: '1.2.0',
        unconstrained: '1.2.1',
      });
    });

    it('range all-blocked -> ENOVERSIONS violation', () => {
      try {
        pickNpmVersion('^1.0.0', pkgB, policy);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'No versions available for pkg-b'
        );
      }
    });

    it('latest tag degrades to newest mature (2.0.0 -> 1.2.0)', () => {
      expect(pickNpmVersion('latest', pkgA, policy)).toEqual({
        version: '1.2.0',
        unconstrained: '2.0.0',
      });
    });

    it('non-latest tag (hot -> 2.0.0) degrades to 1.2.0', () => {
      expect(pickNpmVersion('hot', pkgA, policy)).toEqual({
        version: '1.2.0',
        unconstrained: '2.0.0',
      });
    });

    it('prerelease tag degrades within its line (canary.3 -> canary.1)', () => {
      expect(pickNpmVersion('canary', pkgA, policy)).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('prerelease range degrades within its line', () => {
      expect(
        pickNpmVersion('>=3.0.0-canary.1 <3.0.0-canary.9', pkgA, policy)
      ).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('too-new rc tag never crosses into a pr/beta channel -> latest stable', () => {
      // next -> 23.0.0-rc.0 is too new. The internal 23.0.0-pr.5 and 23.0.0-beta.1
      // are different channels (excluded), and the only same-channel candidate is
      // the cross-line 22.7.0-rc.2, which loses to the stable 22.7.0.
      expect(pickNpmVersion('next', pkgChannels, policy)).toEqual({
        version: '22.7.0',
        unconstrained: '23.0.0-rc.0',
      });
    });

    it('too-new rc tag keeps a compliant same-line rc', () => {
      // pre -> 23.1.0-rc.4 is too new, but 23.1.0-rc.1 (same channel, same line)
      // is compliant and outranks every stable below 23.x.
      expect(pickNpmVersion('pre', pkgChannels, policy)).toEqual({
        version: '23.1.0-rc.1',
        unconstrained: '23.1.0-rc.4',
      });
    });

    it('tag pointing at an already-mature version returns it', () => {
      expect(pickNpmVersion('stable-old', pkgA, policy)).toEqual({
        version: '1.0.1',
        unconstrained: '1.0.1',
      });
    });

    it('unknown dist-tag -> ETARGET violation (not ENOVERSIONS)', () => {
      try {
        pickNpmVersion('nonexistent', pkgA, policy);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toContain(
          'No matching version found for pkg-a@nonexistent with a date before'
        );
      }
    });
  });

  describe('boundary inclusivity', () => {
    const policy = policyWithWindow(24);

    it('age == window passes (24.2h old version under a 24h window)', () => {
      expect(pickNpmVersion('1.0.0', pkgEdge, policy)).toEqual({
        version: '1.0.0',
        unconstrained: '1.0.0',
      });
    });

    it('just-too-new (23.8h) exact pin -> violation', () => {
      expect(() => pickNpmVersion('1.0.1', pkgEdge, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('excludes bypass', () => {
    it('an excluded exact pin passes despite being too new', () => {
      const policy = policyWithExcludes(
        24,
        (name, version) => name === 'pkg-a' && version === '2.0.0'
      );
      expect(pickNpmVersion('2.0.0', pkgA, policy)).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
      });
    });
  });

  describe('missing time', () => {
    const policy = policyWithWindow(24);

    it('an individual missing time entry passes (npm tolerates)', () => {
      const meta = metadataFromAges(
        'pkg-partial',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeFor: ['1.1.0'] }
      );
      expect(pickNpmVersion('^1.0.0', meta, policy)).toEqual({
        version: '1.1.0',
        unconstrained: '1.1.0',
      });
    });

    it('exact pin to a published-but-no-time version passes (npm tolerates)', () => {
      // The version exists in `versions` but the registry omitted its time entry;
      // npm-pick-manifest resolves the manifest and isBefore passes (missing time).
      const meta = metadataFromAges(
        'pkg-partial',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeFor: ['1.1.0'] }
      );
      expect(pickNpmVersion('1.1.0', meta, policy)).toEqual({
        version: '1.1.0',
        unconstrained: '1.1.0',
      });
    });

    it('a whole missing time map passes everything', () => {
      const meta = metadataFromAges(
        'pkg-no-time',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeMap: true }
      );
      expect(pickNpmVersion('latest', meta, policy)).toEqual({
        version: '1.1.0',
        unconstrained: '1.1.0',
      });
    });
  });

  describe('readNpmPolicy', () => {
    const execSyncMock = childProcess.execSync as jest.Mock;
    const readNpmrcEntriesMock = readNpmrcEntries as jest.Mock;

    // path -> .npmrc contents; absent paths read as missing files.
    let npmrcFiles: Record<string, string>;

    beforeEach(() => {
      npmrcFiles = {};
      readNpmrcEntriesMock.mockImplementation((p: string) =>
        parseNpmrcEntries(npmrcFiles[p])
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    function mockConfig(config: Record<string, unknown>) {
      execSyncMock.mockReturnValue(JSON.stringify(config));
    }

    it('no cooldown keys -> inactive', async () => {
      mockConfig({ registry: 'https://registry.npmjs.org/' });
      await expect(readNpmPolicy('/root', '11.16.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('min-release-age 0 -> inactive', async () => {
      mockConfig({ 'min-release-age': 0 });
      await expect(readNpmPolicy('/root', '11.16.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('negative min-release-age -> inactive (future cutoff)', async () => {
      mockConfig({ 'min-release-age': -5 });
      await expect(readNpmPolicy('/root', '11.16.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('positive min-release-age -> active with derived window', async () => {
      mockConfig({ 'min-release-age': 1.5 });
      const result = await readNpmPolicy('/root', '11.16.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(1.5 * 86_400_000);
        expect(result.policy.behavior.packageManager).toBe('npm');
        expect(result.policy.isExcluded('any', '1.0.0')).toBe(false);
      }
    });

    it('invalid min-release-age -> ambiguous', async () => {
      mockConfig({ 'min-release-age': 'abc' });
      const result = await readNpmPolicy('/root', '11.16.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('before only -> active (date cutoff)', async () => {
      mockConfig({ before: '2020-01-01T00:00:00.000Z' });
      const result = await readNpmPolicy('/root', '11.16.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.cutoffMs).toBe(
          Date.parse('2020-01-01T00:00:00.000Z')
        );
      }
    });

    it('future before -> inactive', async () => {
      mockConfig({ before: '2999-01-01T00:00:00.000Z' });
      await expect(readNpmPolicy('/root', '11.16.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    describe('both keys on 11.15+ (per-source flatten)', () => {
      const BEFORE = '2020-01-01T00:00:00.000Z';

      it('undetectable sources (both rank lowest) -> before wins', async () => {
        mockConfig({ 'min-release-age': 7, before: BEFORE });
        const result = await readNpmPolicy('/root', '11.16.0', {});
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.cutoffMs).toBe(Date.parse(BEFORE));
        }
      });

      it('before in a lower source than min-release-age -> min-release-age wins', async () => {
        // before from user .npmrc (rank 1) < min-release-age from env (rank 3).
        mockConfig({ 'min-release-age': 7, before: BEFORE });
        npmrcFiles['/home/user/.npmrc'] = `before=${BEFORE}\n`;
        const result = await readNpmPolicy('/root', '11.16.0', {
          npm_config_min_release_age: '7',
        });
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.windowMs).toBe(7 * 86_400_000);
        }
      });

      it('before in a higher source than min-release-age -> before wins', async () => {
        // min-release-age from project .npmrc (rank 2) < before from env (rank 3).
        mockConfig({ 'min-release-age': 7, before: BEFORE });
        npmrcFiles['/root/.npmrc'] = `min-release-age=7\n`;
        const result = await readNpmPolicy('/root', '11.16.0', {
          npm_config_before: BEFORE,
        });
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.cutoffMs).toBe(Date.parse(BEFORE));
        }
      });

      it('both keys in the same source -> before wins (hasOwn guard)', async () => {
        // project .npmrc carries both at the same rank -> before wins there.
        mockConfig({ 'min-release-age': 7, before: BEFORE });
        npmrcFiles['/root/.npmrc'] = `min-release-age=7\nbefore=${BEFORE}\n`;
        const result = await readNpmPolicy('/root', '11.16.0', {});
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.cutoffMs).toBe(Date.parse(BEFORE));
        }
      });

      it('min-release-age 0 wins over a lower-ranked before -> inactive', async () => {
        // env min-release-age=0 (rank 3) overwrites user before -> disabled.
        mockConfig({ 'min-release-age': 0, before: BEFORE });
        npmrcFiles['/home/user/.npmrc'] = `before=${BEFORE}\n`;
        const result = await readNpmPolicy('/root', '11.16.0', {
          npm_config_min_release_age: '0',
        });
        expect(result).toEqual({ outcome: 'inactive' });
      });

      it('hyphenated env var name is detected (npm normalizes _ to - in loadEnv)', async () => {
        // npm_config_min-release-age maps to the kebab key, so this env source
        // (rank 3) outranks the user-.npmrc before (rank 1) -> min-release-age wins.
        mockConfig({ 'min-release-age': 7, before: BEFORE });
        npmrcFiles['/home/user/.npmrc'] = `before=${BEFORE}\n`;
        const result = await readNpmPolicy('/root', '11.16.0', {
          'npm_config_min-release-age': '7',
        });
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.windowMs).toBe(7 * 86_400_000);
        }
      });

      it('uppercase env var is detected (npm matches npm_config_ case-insensitively)', async () => {
        mockConfig({ 'min-release-age': 7, before: BEFORE });
        npmrcFiles['/home/user/.npmrc'] = `before=${BEFORE}\n`;
        const result = await readNpmPolicy('/root', '11.16.0', {
          NPM_CONFIG_MIN_RELEASE_AGE: '7',
        });
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.windowMs).toBe(7 * 86_400_000);
        }
      });
    });

    it('both keys on 11.10-11.14 -> ambiguous', async () => {
      mockConfig({
        'min-release-age': 7,
        before: '2020-01-01T00:00:00.000Z',
      });
      const result = await readNpmPolicy('/root', '11.12.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('config read failure -> ambiguous', async () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('npm not found');
      });
      const result = await readNpmPolicy('/root', '11.16.0');
      expect(result.outcome).toBe('ambiguous');
    });
  });
});
