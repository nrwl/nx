import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MinReleaseAgeViolationError } from '../errors';
import type { RegistryMetadata } from '../packument';
import type { MinReleaseAgePolicy } from '../policy';
import { pickBunVersion, readBunPolicy } from './bun';

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

function policyWithWindow(windowHours: number): MinReleaseAgePolicy {
  const windowMs = windowHours * HOUR;
  return {
    packageManagerVersion: '1.3.0',
    cutoffMs: NOW - windowMs,
    windowMs,
    sourceDescription: `bun minimumReleaseAge (${windowHours * 3600} seconds)`,
    isExcluded: () => false,
    behavior: { packageManager: 'bun' },
  };
}

function policyWithExcludes(
  windowHours: number,
  excluded: (name: string, version: string) => boolean
): MinReleaseAgePolicy {
  return { ...policyWithWindow(windowHours), isExcluded: excluded };
}

describe('bun min-release-age behavior', () => {
  let nowSpy: jest.SpyInstance;
  beforeAll(() => {
    // Pin the clock so the stability walk's search bound is deterministic.
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterAll(() => nowSpy.mockRestore());

  describe('pickBunVersion (24h window)', () => {
    const policy = policyWithWindow(24);

    it('exact mature pin passes through', () => {
      expect(pickBunVersion('1.1.1', pkgA, policy)).toEqual({
        version: '1.1.1',
        unconstrained: '1.1.1',
      });
    });

    it('exact too-new pin -> TooRecentVersion violation', () => {
      expect(() => pickBunVersion('2.0.0', pkgA, policy)).toThrow(
        MinReleaseAgeViolationError
      );
      try {
        pickBunVersion('2.0.0', pkgA, policy);
      } catch (e) {
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toContain(
          'pkg-a@2.0.0 was blocked by minimum-release-age'
        );
        expect((e as MinReleaseAgeViolationError).blocked).toEqual([
          { version: '2.0.0', publishedAt: pkgA.time!['2.0.0'] },
        ]);
      }
    });

    it('range picks 1.1.1 (stable) over 1.2.0 (age-passing but unstable)', () => {
      // 2.0.0/1.2.1 too new; 1.2.0 passes but the gap to 1.2.1 is 13h < 24h
      // (unstable); 1.1.1 has a 47h gap to 1.2.0 (>= 24h) -> stable.
      expect(pickBunVersion('^1.0.0', pkgA, policy)).toEqual({
        version: '1.1.1',
        unconstrained: '1.2.1',
      });
    });

    it.each(['*', '>=1.0.0'])(
      'stable range %s walks releases only, never prereleases (-> 1.1.1)',
      (spec) => {
        // bun searches its `releases` list for a stable range and only consults
        // `prereleases` when the range carries a prerelease comparator. So the
        // 3.0.0 canaries/beta never enter the walk: 2.0.0/1.2.1 too new, 1.2.0
        // unstable, 1.1.1 stable. Unconstrained is the newest stable in range.
        expect(pickBunVersion(spec, pkgA, policy)).toEqual({
          version: '1.1.1',
          unconstrained: '2.0.0',
        });
      }
    );

    it('range all-blocked -> violation', () => {
      expect(() => pickBunVersion('^1.0.0', pkgB, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });

    it('range latest fast path returns latest before any stability walk', () => {
      // findBestVersionWithFilter checks `latest` first: 2.1.0 is in range and
      // age-passing (28h >= 24h), so it returns immediately. The stability walk
      // would instead pick the older stable 2.0.0 (2.1.0 is unstable: 23h gap to
      // the too-recent 2.2.0), so this pins the fast-path short-circuit.
      const meta = metadataFromAges(
        'pkg-fastpath',
        { '2.2.0': 5, '2.1.0': 28, '2.0.0': 200 },
        { latest: '2.1.0' }
      );
      expect(pickBunVersion('^2.0.0', meta, policy)).toEqual({
        version: '2.1.0',
        unconstrained: '2.2.0',
      });
    });

    it('range matching zero versions -> plain non-cooldown error', () => {
      // bun returns err.not_found (NoMatchingVersion), not a cooldown error, when
      // nothing is in range; nx throws a plain Error so the install-fallback runs.
      expect(() => pickBunVersion('^9.0.0', pkgA, policy)).toThrow(Error);
      expect(() => pickBunVersion('^9.0.0', pkgA, policy)).not.toThrow(
        MinReleaseAgeViolationError
      );
    });

    it('latest tag degrades via the stability walk (2.0.0 -> 1.1.1)', () => {
      // bun applies the same stability walk to ALL tags (no npm-style <=target).
      expect(pickBunVersion('latest', pkgA, policy)).toEqual({
        version: '1.1.1',
        unconstrained: '2.0.0',
      });
    });

    it('non-latest tag (hot -> 2.0.0) degrades to 1.1.1', () => {
      expect(pickBunVersion('hot', pkgA, policy)).toEqual({
        version: '1.1.1',
        unconstrained: '2.0.0',
      });
    });

    it('prerelease tag stays in its channel (canary -> canary.1, never beta)', () => {
      expect(pickBunVersion('canary', pkgA, policy)).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('prerelease range stays in its channel (canary.3 -> canary.1)', () => {
      expect(
        pickBunVersion('>=3.0.0-canary.1 <3.0.0-canary.9', pkgA, policy)
      ).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('tag pointing at an already-mature version returns it', () => {
      expect(pickBunVersion('stable-old', pkgA, policy)).toEqual({
        version: '1.0.1',
        unconstrained: '1.0.1',
      });
    });

    it('unknown tag -> violation', () => {
      expect(() => pickBunVersion('nope', pkgA, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('search-bound fallback to the newest age-passing version', () => {
    // window 1h -> search bound = now - (1h + 7d) = now - 169h. The only stable
    // gap would need >= 1h, but here consecutive blocked/unstable versions push
    // the walk past the bound, so it falls back to the newest age-passing one.
    const policy = policyWithWindow(1);

    it('returns the newest age-passing version when no stable gap exists', () => {
      // 2.0.0 (6h) too new under... no: 1h window -> 6h passes. Build a fixture
      // where the newest is too new and the rest are a long unstable chain.
      const meta = metadataFromAges(
        'pkg-chain',
        {
          // newest is inside the 1h window (blocked)
          '1.5.0': 0.5,
          // age-passing but each gap to the next-newer is < 1h (unstable),
          // and all sit beyond the now-169h search bound
          '1.4.0': 200.0,
          '1.3.0': 200.4,
          '1.2.0': 200.8,
        },
        { latest: '1.5.0' }
      );
      // First age-passing candidate after the bound is the fallback: the newest
      // age-passing version, 1.4.0.
      expect(pickBunVersion('^1.0.0', meta, policy)).toEqual({
        version: '1.4.0',
        unconstrained: '1.5.0',
      });
    });
  });

  describe('boundary inclusivity', () => {
    const policy = policyWithWindow(24);

    it('age == window passes (24.2h old version under a 24h window)', () => {
      expect(pickBunVersion('1.0.0', pkgEdge, policy)).toEqual({
        version: '1.0.0',
        unconstrained: '1.0.0',
      });
    });

    it('just-too-new (23.8h) exact pin -> violation', () => {
      expect(() => pickBunVersion('1.0.1', pkgEdge, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });

    it('exactly at the cutoff passes (publish == cutoff)', () => {
      const meta = metadataFromAges(
        'pkg-exact',
        { '1.0.0': 24 },
        {
          latest: '1.0.0',
        }
      );
      expect(pickBunVersion('1.0.0', meta, policyWithWindow(24))).toEqual({
        version: '1.0.0',
        unconstrained: '1.0.0',
      });
    });
  });

  describe('excludes byte-equality', () => {
    it('an excluded exact pin passes despite being too new', () => {
      const policy = policyWithExcludes(24, (name) => name === 'pkg-a');
      expect(pickBunVersion('2.0.0', pkgA, policy)).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
      });
    });

    it('a near-miss name does not match (case-sensitive, no partial)', () => {
      const policy = policyWithExcludes(24, (name) => name === 'PKG-A');
      expect(() => pickBunVersion('2.0.0', pkgA, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('missing/future time', () => {
    const policy = policyWithWindow(24);

    it('an individual missing time entry passes (timestamp 0)', () => {
      const meta = metadataFromAges(
        'pkg-partial-time',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeFor: ['1.1.0'] }
      );
      expect(pickBunVersion('^1.0.0', meta, policy)).toEqual({
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
      expect(pickBunVersion('latest', meta, policy)).toEqual({
        version: '1.1.0',
        unconstrained: '1.1.0',
      });
    });

    it('a future publish time is blocked', () => {
      const meta = metadataFromAges(
        'pkg-future',
        { '1.0.0': 720, '1.1.0': -5 },
        { latest: '1.1.0' }
      );
      // 1.1.0 is published 5h in the future -> blocked; degrades to 1.0.0.
      expect(pickBunVersion('^1.0.0', meta, policy)).toEqual({
        version: '1.0.0',
        unconstrained: '1.1.0',
      });
    });
  });

  describe('readBunPolicy', () => {
    let root: string;
    let xdgHome: string;
    let userHome: string;
    const savedXdg = process.env.XDG_CONFIG_HOME;
    const savedHome = process.env.HOME;

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'bun-project-'));
      xdgHome = mkdtempSync(join(tmpdir(), 'bun-xdg-'));
      userHome = mkdtempSync(join(tmpdir(), 'bun-home-'));
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
      rmSync(xdgHome, { recursive: true, force: true });
      rmSync(userHome, { recursive: true, force: true });
      if (savedXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = savedXdg;
      }
      if (savedHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = savedHome;
      }
    });

    function writeProjectBunfig(contents: string) {
      writeFileSync(join(root, 'bunfig.toml'), contents);
    }

    it('no bunfig -> inactive', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      await expect(readBunPolicy(root, '1.3.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('no [install] minimumReleaseAge -> inactive', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install]\nsaveTextLockfile = true\n');
      await expect(readBunPolicy(root, '1.3.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('minimumReleaseAge in seconds -> active window', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install]\nminimumReleaseAge = 86400\n');
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(86400 * 1000);
        expect(result.policy.behavior.packageManager).toBe('bun');
        expect(result.policy.sourceDescription).toContain('86400 seconds');
      }
    });

    it('float seconds are accepted', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install]\nminimumReleaseAge = 1.5\n');
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(1500);
      }
    });

    it('0 -> inactive', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install]\nminimumReleaseAge = 0\n');
      await expect(readBunPolicy(root, '1.3.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('negative -> ambiguous', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install]\nminimumReleaseAge = -10\n');
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('non-number value -> ambiguous', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install]\nminimumReleaseAge = "soon"\n');
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('minimumReleaseAgeExcludes is exact-name, case-sensitive', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig(
        '[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = ["pkg-a"]\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.isExcluded('pkg-a', '2.0.0')).toBe(true);
        expect(result.policy.isExcluded('PKG-A', '2.0.0')).toBe(false);
        expect(result.policy.isExcluded('pkg-a-extra', '2.0.0')).toBe(false);
      }
    });

    it('non-array minimumReleaseAgeExcludes -> ambiguous', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      // bun's bunfig parser hard-errors on a non-array (install dies).
      writeProjectBunfig(
        '[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = "pkg-a"\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('non-string element in minimumReleaseAgeExcludes -> ambiguous', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      // A non-string element makes bun's expectString fail (install dies).
      writeProjectBunfig(
        '[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = ["pkg-a", 7]\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('empty minimumReleaseAgeExcludes array is a no-op', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig(
        '[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = []\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.isExcluded('pkg-a', '2.0.0')).toBe(false);
      }
    });

    it('the singular minimumReleaseAgeExclude key is silently ignored', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig(
        '[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExclude = ["pkg-a"]\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.isExcluded('pkg-a', '2.0.0')).toBe(false);
      }
    });

    it('local bunfig overrides global per key', async () => {
      process.env.XDG_CONFIG_HOME = xdgHome;
      writeFileSync(
        join(xdgHome, '.bunfig.toml'),
        '[install]\nminimumReleaseAge = 600\n'
      );
      writeProjectBunfig('[install]\nminimumReleaseAge = 86400\n');
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(86400 * 1000);
      }
    });

    it('global XDG bunfig applies when XDG_CONFIG_HOME is set', async () => {
      process.env.XDG_CONFIG_HOME = xdgHome;
      process.env.HOME = userHome;
      writeFileSync(
        join(xdgHome, '.bunfig.toml'),
        '[install]\nminimumReleaseAge = 3600\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(3600 * 1000);
      }
    });

    it('HOME/.bunfig.toml is NOT read when XDG_CONFIG_HOME is set', async () => {
      process.env.XDG_CONFIG_HOME = xdgHome;
      process.env.HOME = userHome;
      // Only the HOME bunfig sets the gate; XDG is empty -> gate must be off.
      writeFileSync(
        join(userHome, '.bunfig.toml'),
        '[install]\nminimumReleaseAge = 3600\n'
      );
      await expect(readBunPolicy(root, '1.3.0')).resolves.toEqual({
        outcome: 'inactive',
      });
    });

    it('HOME/.bunfig.toml IS read when XDG_CONFIG_HOME is unset', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeFileSync(
        join(userHome, '.bunfig.toml'),
        '[install]\nminimumReleaseAge = 3600\n'
      );
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(3600 * 1000);
      }
    });

    it('unparseable bunfig -> ambiguous', async () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.HOME = userHome;
      writeProjectBunfig('[install\nminimumReleaseAge = =\n');
      const result = await readBunPolicy(root, '1.3.0');
      expect(result.outcome).toBe('ambiguous');
    });
  });
});
