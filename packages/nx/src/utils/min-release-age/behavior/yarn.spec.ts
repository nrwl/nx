jest.mock('child_process');
// os.homedir() reads the native home and ignores a runtime process.env.HOME
// override inside jest, so mock it to redirect home to a temp dir per test.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => jest.requireActual('os').homedir()),
}));

import * as childProcess from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { MinReleaseAgeViolationError } from '../errors';
import type { RegistryMetadata } from '../packument';
import type { MinReleaseAgePolicy } from '../policy';
import { pickYarnVersion, readYarnPolicy } from './yarn';

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

function policy(
  windowHours: number,
  opts: {
    pmVersion?: string;
    missingVersionTime?: 'pass' | 'quarantine';
    isExcluded?: (name: string, version: string) => boolean;
  } = {}
): MinReleaseAgePolicy {
  const windowMs = windowHours * HOUR;
  return {
    packageManager: 'yarn',
    packageManagerVersion: opts.pmVersion ?? '4.16.0',
    cutoffMs: NOW - windowMs,
    windowMs,
    sourceDescription: `yarn npmMinimalAgeGate (${windowHours * 60} min)`,
    isExcluded: opts.isExcluded ?? (() => false),
    behavior: {
      packageManager: 'yarn',
      missingVersionTime: opts.missingVersionTime ?? 'quarantine',
    },
  };
}

describe('yarn min-release-age behavior', () => {
  describe('pickYarnVersion (24h window)', () => {
    const p = policy(24);

    it('exact mature pin passes through (exact-mature)', () => {
      expect(pickYarnVersion('1.1.1', pkgA, p)).toEqual({
        version: '1.1.1',
        unconstrained: '1.1.1',
      });
    });

    it('exact too-new pin -> YN0016 violation (exact-toonew)', () => {
      expect(() => pickYarnVersion('2.0.0', pkgA, p)).toThrow(
        MinReleaseAgeViolationError
      );
      try {
        pickYarnVersion('2.0.0', pkgA, p);
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'All versions satisfying "2.0.0" are quarantined'
        );
      }
    });

    it('range degrades to the newest approved match (^1 -> 1.2.0)', () => {
      expect(pickYarnVersion('^1.0.0', pkgA, p)).toEqual({
        version: '1.2.0',
        unconstrained: '1.2.1',
      });
    });

    it('range with no approved match -> violation (range-nomature)', () => {
      expect(() => pickYarnVersion('^1.0.0', pkgB, p)).toThrow(
        MinReleaseAgeViolationError
      );
    });

    it('latest tag degrades to newest approved (tag-latest 2.0.0 -> 1.2.0)', () => {
      expect(pickYarnVersion('latest', pkgA, p)).toEqual({
        version: '1.2.0',
        unconstrained: '2.0.0',
      });
    });

    it('non-latest tag too new -> violation references derived ^range (tag-nonlatest)', () => {
      expect(() => pickYarnVersion('hot', pkgA, p)).toThrow(
        MinReleaseAgeViolationError
      );
      try {
        pickYarnVersion('hot', pkgA, p);
      } catch (e) {
        // yarn add re-resolves the tag through the gated semver resolver using a
        // `^<target>` range (default modifier), so the message names ^2.0.0.
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'All versions satisfying "^2.0.0" are quarantined'
        );
      }
    });

    it('prerelease tag too new -> violation references derived ^range (tag-prerelease)', () => {
      expect(() => pickYarnVersion('canary', pkgA, p)).toThrow(
        MinReleaseAgeViolationError
      );
      try {
        pickYarnVersion('canary', pkgA, p);
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'All versions satisfying "^3.0.0-canary.3" are quarantined'
        );
      }
    });

    it('prerelease range degrades within its line (range-prerelease)', () => {
      expect(
        pickYarnVersion('>=3.0.0-canary.1 <3.0.0-canary.9', pkgA, p)
      ).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('tag pointing at an already-approved version returns it (tag-stableold)', () => {
      expect(pickYarnVersion('stable-old', pkgA, p)).toEqual({
        version: '1.0.1',
        unconstrained: '1.0.1',
      });
    });

    it('unknown tag -> violation', () => {
      expect(() => pickYarnVersion('does-not-exist', pkgA, p)).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('error shape flips at 4.13', () => {
    it('YN0082 generic wording below 4.13', () => {
      try {
        pickYarnVersion('2.0.0', pkgA, policy(24, { pmVersion: '4.12.0' }));
        throw new Error('expected throw');
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'pkg-a@2.0.0: No candidates found'
        );
      }
    });

    it('YN0016 wording at 4.13+', () => {
      try {
        pickYarnVersion('^1.0.0', pkgB, policy(24, { pmVersion: '4.13.0' }));
        throw new Error('expected throw');
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'All versions satisfying "^1.0.0" are quarantined'
        );
      }
    });

    it('latest walk-down with no lower version -> dedicated tag message', () => {
      // Every version too new -> latest cannot fall back.
      const allFresh = metadataFromAges(
        'pkg-fresh',
        { '1.0.0': 2, '1.1.0': 1 },
        { latest: '1.1.0' }
      );
      try {
        pickYarnVersion('latest', allFresh, policy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toBe(
          'The version for tag "latest" is quarantined, and no lower version is available'
        );
      }
    });
  });

  describe('walk-down prerelease tolerance flips at 4.11', () => {
    // latest is a too-new stable; the only approved lower version is a
    // prerelease, all lower stables are too new.
    const meta = metadataFromAges(
      'pkg-pre',
      { '2.0.0': 1, '1.5.0': 2, '1.0.0-beta.1': 9600 },
      { latest: '2.0.0' }
    );

    it('pre-4.11 tolerates a lower prerelease in the fallback', () => {
      expect(
        pickYarnVersion('latest', meta, policy(24, { pmVersion: '4.10.1' }))
      ).toEqual({ version: '1.0.0-beta.1', unconstrained: '2.0.0' });
    });

    it('4.11+ excludes prereleases when latest is stable -> violation', () => {
      expect(() =>
        pickYarnVersion('latest', meta, policy(24, { pmVersion: '4.11.0' }))
      ).toThrow(MinReleaseAgeViolationError);
    });

    it('4.11+ tolerates a lower prerelease when latest is itself a prerelease', () => {
      const preLatest = metadataFromAges(
        'pkg-prelatest',
        { '3.0.0-canary.3': 2, '3.0.0-canary.1': 9600 },
        { latest: '3.0.0-canary.3' }
      );
      expect(
        pickYarnVersion(
          'latest',
          preLatest,
          policy(24, { pmVersion: '4.11.0' })
        )
      ).toEqual({ version: '3.0.0-canary.1', unconstrained: '3.0.0-canary.3' });
    });
  });

  describe('boundary inclusivity', () => {
    const p = policy(24);

    it('age == window passes (24.2h old version under a 24h window)', () => {
      expect(pickYarnVersion('1.0.0', pkgEdge, p)).toEqual({
        version: '1.0.0',
        unconstrained: '1.0.0',
      });
    });

    it('just-too-new (23.8h) exact pin -> violation', () => {
      expect(() => pickYarnVersion('1.0.1', pkgEdge, p)).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('missing time', () => {
    it('individual missing time passes on 4.10.0-4.10.1', () => {
      const meta = metadataFromAges(
        'pkg-partial-time',
        { '1.0.0': 9600, '1.1.0': 2 },
        { latest: '1.1.0' },
        { omitTimeFor: ['1.1.0'] }
      );
      expect(
        pickYarnVersion(
          '^1.0.0',
          meta,
          policy(24, { pmVersion: '4.10.1', missingVersionTime: 'pass' })
        )
      ).toEqual({ version: '1.1.0', unconstrained: '1.1.0' });
    });

    it('individual missing time quarantined on >=4.10.2 (partial-time-range -> 1.0.0)', () => {
      const meta = metadataFromAges(
        'pkg-partial-time',
        { '1.0.0': 9600, '1.1.0': 2 },
        { latest: '1.1.0' },
        { omitTimeFor: ['1.1.0'] }
      );
      expect(pickYarnVersion('^1.0.0', meta, policy(24))).toEqual({
        version: '1.0.0',
        unconstrained: '1.1.0',
      });
    });

    it('whole missing time map quarantines everything (>=4.10.2)', () => {
      const meta = metadataFromAges(
        'pkg-no-time',
        { '1.0.0': 9600, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeMap: true }
      );
      expect(() => pickYarnVersion('1.1.0', meta, policy(24))).toThrow(
        MinReleaseAgeViolationError
      );
    });

    it('whole missing time map passes everything on 4.10.1', () => {
      const meta = metadataFromAges(
        'pkg-no-time',
        { '1.0.0': 9600, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeMap: true }
      );
      expect(
        pickYarnVersion(
          '1.1.0',
          meta,
          policy(24, { pmVersion: '4.10.1', missingVersionTime: 'pass' })
        )
      ).toEqual({ version: '1.1.0', unconstrained: '1.1.0' });
    });
  });

  describe('excludes (npmPreapprovedPackages descriptor forms)', () => {
    it('bare ident bypasses any version (exclude-name)', () => {
      const p = policy(24, {
        isExcluded: (name) => name === 'pkg-a',
      });
      expect(pickYarnVersion('2.0.0', pkgA, p)).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
      });
    });

    it('name@range bypasses only matching versions (exclude-version-spec)', () => {
      const p = policy(24, {
        isExcluded: (name, version) =>
          name === 'pkg-a' && satisfies(version, '^2.0.0'),
      });
      expect(pickYarnVersion('2.0.0', pkgA, p)).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
      });
    });
  });

  describe('readYarnPolicy', () => {
    const execSyncMock = childProcess.execSync as jest.Mock;
    let tmp: string;
    let home: string;
    const savedGateEnv = process.env.YARN_NPM_MINIMAL_AGE_GATE;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), 'nx-yarn-mra-'));
      home = mkdtempSync(join(tmpdir(), 'nx-yarn-home-'));
      (homedir as jest.Mock).mockReturnValue(home);
      delete process.env.YARN_NPM_MINIMAL_AGE_GATE;
    });

    afterEach(() => {
      jest.clearAllMocks();
      rmSync(tmp, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      if (savedGateEnv === undefined) {
        delete process.env.YARN_NPM_MINIMAL_AGE_GATE;
      } else {
        process.env.YARN_NPM_MINIMAL_AGE_GATE = savedGateEnv;
      }
    });

    function mockYarn(gate: unknown, preapproved: unknown = []) {
      execSyncMock.mockImplementation((cmd: string) =>
        cmd.includes('npmMinimalAgeGate')
          ? JSON.stringify(gate)
          : JSON.stringify(preapproved)
      );
    }

    function writeLockfile(version: number) {
      writeFileSync(
        join(tmp, 'yarn.lock'),
        `__metadata:\n  version: ${version}\n  cacheKey: 10c0\n`
      );
    }

    function writeV1Lockfile() {
      // Legacy yarn-classic v1 lockfile: header comment, no __metadata block.
      writeFileSync(
        join(tmp, 'yarn.lock'),
        '# THIS IS AN AUTOGENERATED FILE.\n# yarn lockfile v1\n\n\nsome-dep@^1.0.0:\n  version "1.0.0"\n'
      );
    }

    async function activePolicy(
      gate: unknown,
      preapproved: unknown = [],
      pmVersion = '4.16.0'
    ): Promise<MinReleaseAgePolicy> {
      mockYarn(gate, preapproved);
      const result = await readYarnPolicy(tmp, pmVersion);
      if (result.outcome !== 'active') {
        throw new Error(`expected active, got ${result.outcome}`);
      }
      return result.policy;
    }

    it('window 0 -> inactive (window-zero)', async () => {
      mockYarn(0);
      await expect(readYarnPolicy(tmp, '4.16.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('null gate (4.10.x NaN parseInt) -> inactive (window-invalid on 4.10.1)', async () => {
      mockYarn(null);
      await expect(readYarnPolicy(tmp, '4.10.1')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('negative gate -> inactive (future cutoff)', async () => {
      mockYarn(-5);
      await expect(readYarnPolicy(tmp, '4.10.1')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('config get throwing (4.11+ duration parse error) -> ambiguous', async () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('Couldn\'t parse "abc" as a duration');
      });
      const result = await readYarnPolicy(tmp, '4.16.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('bare-number minutes window (yarn-bare-number-minutes)', async () => {
      // 4320 minutes = 72h window.
      const pol = await activePolicy(4320);
      expect(pol.windowMs).toBe(4320 * 60_000);
      expect(pol.behavior).toEqual({
        packageManager: 'yarn',
        missingVersionTime: 'quarantine',
      });
    });

    it('missingVersionTime is "pass" on 4.10.1', async () => {
      const pol = await activePolicy(60, [], '4.10.1');
      expect(pol.behavior).toEqual({
        packageManager: 'yarn',
        missingVersionTime: 'pass',
      });
    });

    it('duration-36h: 4.10.x parseInt window (36 min)', async () => {
      // 4.10.x config get returns parseInt('36h') -> 36 (minutes).
      const pol = await activePolicy(36, [], '4.10.1');
      expect(pol.windowMs).toBe(36 * 60_000);
    });

    it('duration-36h: 4.11+ normalized window (2160 min)', async () => {
      // 4.11+ config get returns the normalized duration: 36h -> 2160 minutes.
      const pol = await activePolicy(2160, [], '4.11.0');
      expect(pol.windowMs).toBe(2160 * 60_000);
    });

    describe('compiled exclude matchers', () => {
      it('bare ident excludes any version', async () => {
        const pol = await activePolicy(1440, ['pkg-a']);
        expect(pol.isExcluded('pkg-a', '2.0.0')).toBe(true);
        expect(pol.isExcluded('pkg-b', '2.0.0')).toBe(false);
      });

      it('name@range excludes only matching versions', async () => {
        const pol = await activePolicy(1440, ['pkg-a@^2.0.0']);
        expect(pol.isExcluded('pkg-a', '2.0.0')).toBe(true);
        expect(pol.isExcluded('pkg-a', '1.0.0')).toBe(false);
      });

      it('scoped glob on the name matches any version (exclude-scoped-glob)', async () => {
        const pol = await activePolicy(1440, ['@s/*']);
        expect(pol.isExcluded('@s/pkg-c', '1.1.0')).toBe(true);
        expect(pol.isExcluded('pkg-c', '1.1.0')).toBe(false);
      });

      it('scoped descriptor with range', async () => {
        const pol = await activePolicy(1440, ['@s/pkg-c@^1.0.0']);
        expect(pol.isExcluded('@s/pkg-c', '1.1.0')).toBe(true);
        expect(pol.isExcluded('@s/pkg-c', '2.0.0')).toBe(false);
      });

      it('stable range does not pre-approve a prerelease (plain Range.test)', async () => {
        // yarn checkIdent uses semver Range.test without includePrerelease, so a
        // prerelease under a stable range is not excluded.
        const pol = await activePolicy(1440, ['pkg-a@>=2.0.0']);
        expect(pol.isExcluded('pkg-a', '2.5.0')).toBe(true);
        expect(pol.isExcluded('pkg-a', '2.5.0-rc.1')).toBe(false);
      });

      it('unscoped glob with range matches name-and-version', async () => {
        const pol = await activePolicy(1440, ['pkg-*@^1.0.0']);
        expect(pol.isExcluded('pkg-a', '1.1.0')).toBe(true);
        // glob matches the name but version is outside the range -> no bypass.
        expect(pol.isExcluded('pkg-a', '2.0.0')).toBe(false);
        expect(pol.isExcluded('other', '1.1.0')).toBe(false);
      });

      it('scoped glob with range matches name-and-version', async () => {
        const pol = await activePolicy(1440, ['@s/*@^1.0.0']);
        expect(pol.isExcluded('@s/pkg-c', '1.1.0')).toBe(true);
        expect(pol.isExcluded('@s/pkg-c', '2.0.0')).toBe(false);
        expect(pol.isExcluded('@other/pkg-c', '1.1.0')).toBe(false);
      });

      it('extglob name entry excludes matching packages (no isGlob gate)', async () => {
        // yarn runs micromatch unconditionally; an extglob like `+(...)` carries
        // none of the chars a hand-rolled isGlob probe looks for, so it must
        // still glob-match rather than be treated as an exact literal.
        const pol = await activePolicy(1440, ['+(pkg-a|pkg-b)']);
        expect(pol.isExcluded('pkg-a', '2.0.0')).toBe(true);
        expect(pol.isExcluded('pkg-b', '2.0.0')).toBe(true);
        expect(pol.isExcluded('pkg-c', '2.0.0')).toBe(false);
      });

      it('case-sensitive name matching', async () => {
        const pol = await activePolicy(1440, ['pkg-a']);
        expect(pol.isExcluded('PKG-A', '2.0.0')).toBe(false);
      });

      it('unparseable range entry -> no bypass (exclude-invalid-pattern)', async () => {
        const pol = await activePolicy(1440, ['pkg-a@not-a-range']);
        expect(pol.isExcluded('pkg-a', '2.0.0')).toBe(false);
      });
    });

    describe('4.15+ lockfile-migration escape', () => {
      it('default window + unset key + lockfile v8 -> inactive (yarn-old-lockfile-escape)', async () => {
        mockYarn(1440);
        writeLockfile(8);
        await expect(readYarnPolicy(tmp, '4.16.0')).resolves.toEqual({
          outcome: 'inactive',
        });
      });

      it('default window + unset key + lockfile v9 -> inactive', async () => {
        mockYarn(1440);
        writeLockfile(9);
        await expect(readYarnPolicy(tmp, '4.16.0')).resolves.toEqual({
          outcome: 'inactive',
        });
      });

      it('default window + unset key + lockfile v10 -> active (default applies)', async () => {
        mockYarn(1440);
        writeLockfile(10);
        const result = await readYarnPolicy(tmp, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('default window + unset key + missing lockfile -> active (fresh project)', async () => {
        mockYarn(1440);
        const result = await readYarnPolicy(tmp, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('default window + key set in project .yarnrc.yml + lockfile v8 -> active', async () => {
        mockYarn(1440);
        writeLockfile(8);
        writeFileSync(join(tmp, '.yarnrc.yml'), 'npmMinimalAgeGate: 1d\n');
        const result = await readYarnPolicy(tmp, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('default window + key set in home .yarnrc.yml + lockfile v8 -> active', async () => {
        mockYarn(1440);
        writeLockfile(8);
        writeFileSync(join(home, '.yarnrc.yml'), 'npmMinimalAgeGate: 2d\n');
        const result = await readYarnPolicy(tmp, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('default window + env explicitly set + lockfile v8 -> active', async () => {
        process.env.YARN_NPM_MINIMAL_AGE_GATE = '1d';
        mockYarn(1440);
        writeLockfile(8);
        const result = await readYarnPolicy(tmp, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('default window + key set in an ancestor .yarnrc.yml + lockfile v8 -> active', async () => {
        // yarn loads every ancestor .yarnrc.yml (findRcFiles dir-walk), so a key
        // set above the project root counts as explicitly set -> no escape.
        const project = join(tmp, 'nested', 'project');
        mkdirSync(project, { recursive: true });
        writeFileSync(
          join(project, 'yarn.lock'),
          '__metadata:\n  version: 8\n  cacheKey: 10c0\n'
        );
        writeFileSync(join(tmp, '.yarnrc.yml'), 'npmMinimalAgeGate: 1d\n');
        mockYarn(1440);
        const result = await readYarnPolicy(project, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('default window + unset key + v1-classic lockfile -> inactive (yarn writes gate 0)', async () => {
        // A v1 lockfile (no __metadata) is lockfileLastVersion = -1; the
        // `v => v < 10` migration selector matches, so install would write
        // npmMinimalAgeGate: 0 -> escape applies (distinct from a missing
        // lockfile, which stays gated).
        mockYarn(1440);
        writeV1Lockfile();
        await expect(readYarnPolicy(tmp, '4.16.0')).resolves.toEqual({
          outcome: 'inactive',
        });
      });

      it('non-default window + lockfile v8 -> active (no escape for explicit value)', async () => {
        mockYarn(2880);
        writeLockfile(8);
        const result = await readYarnPolicy(tmp, '4.16.0');
        expect(result.outcome).toBe('active');
      });

      it('escape does not apply below 4.15.0', async () => {
        mockYarn(1440);
        writeLockfile(8);
        const result = await readYarnPolicy(tmp, '4.14.0');
        expect(result.outcome).toBe('active');
      });
    });
  });
});

import { satisfies } from 'semver';
