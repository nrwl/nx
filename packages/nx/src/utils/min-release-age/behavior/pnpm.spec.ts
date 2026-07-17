import { MinReleaseAgeViolationError } from '../errors';
import type { RegistryMetadata } from '../packument';
import type { MinReleaseAgePolicy, PmMinReleaseAgeBehavior } from '../policy';
import { pickPnpmVersion, readPnpmPolicy } from './pnpm';

const HOUR = 3_600_000;
const MINUTE = 60_000;
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

// All versions younger than 24h.
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

// A latest tag whose target is a too-new new-major; degrade has no same-major
// mature candidate but a lower major does.
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

// Every version younger than the 24h window: a too-new tag has no compliant
// degrade candidate, exercising the strict-violation / loose-immature paths.
const pkgAllTooNew = metadataFromAges(
  'pkg-allnew',
  { '1.2.0': 12, '2.0.0': 6 },
  { latest: '1.2.0', hot: '2.0.0' }
);

function basePolicy(
  windowHours: number,
  behaviorOverrides: Partial<
    Extract<PmMinReleaseAgeBehavior, { packageManager: 'pnpm' }>
  > = {},
  policyOverrides: Partial<MinReleaseAgePolicy> = {}
): MinReleaseAgePolicy {
  const windowMs = windowHours * HOUR;
  return {
    packageManagerVersion: '11.5.2',
    cutoffMs: NOW - windowMs,
    windowMs,
    sourceDescription: `pnpm minimumReleaseAge (${windowHours * 60} min)`,
    isExcluded: () => false,
    behavior: {
      packageManager: 'pnpm',
      strict: true,
      looseFallback: false,
      writesExcludes: false,
      missingTimeMap: 'error',
      ...behaviorOverrides,
    },
    ...policyOverrides,
  };
}

// v10: strict-only, same-major latest degrade, error on missing whole map.
function v10Policy(
  windowHours: number,
  policyOverrides: Partial<MinReleaseAgePolicy> = {}
): MinReleaseAgePolicy {
  return basePolicy(
    windowHours,
    {
      strict: true,
      looseFallback: false,
      writesExcludes: false,
      missingTimeMap: 'error',
    },
    { packageManagerVersion: '10.16.0', ...policyOverrides }
  );
}

// v11 strict auto-on (>=11.0.4).
function v11StrictPolicy(
  windowHours: number,
  policyOverrides: Partial<MinReleaseAgePolicy> = {}
): MinReleaseAgePolicy {
  return basePolicy(
    windowHours,
    {
      strict: true,
      looseFallback: false,
      writesExcludes: true,
      missingTimeMap: 'skip',
    },
    { packageManagerVersion: '11.5.2', ...policyOverrides }
  );
}

// v11 strict in the 11.0.0..11.1.2 band, where a too-new range/exact emits the
// single-version NO_MATURE form (and a too-new tag falls back to NO_MATCHING).
function v11SingleFormStrictPolicy(
  windowHours: number,
  policyOverrides: Partial<MinReleaseAgePolicy> = {}
): MinReleaseAgePolicy {
  return basePolicy(
    windowHours,
    {
      strict: true,
      looseFallback: false,
      writesExcludes: false,
      missingTimeMap: 'skip',
    },
    { packageManagerVersion: '11.1.0', ...policyOverrides }
  );
}

// v11 loose (default 1440, strict off).
function v11LoosePolicy(
  windowHours: number,
  policyOverrides: Partial<MinReleaseAgePolicy> = {}
): MinReleaseAgePolicy {
  return basePolicy(
    windowHours,
    {
      strict: false,
      looseFallback: true,
      writesExcludes: false,
      missingTimeMap: 'skip',
    },
    { packageManagerVersion: '11.0.0', ...policyOverrides }
  );
}

describe('pnpm min-release-age behavior', () => {
  describe('pickPnpmVersion - shared maturity (24h window)', () => {
    it('exact mature pin passes through (exact-mature)', () => {
      expect(pickPnpmVersion('1.1.1', pkgA, v10Policy(24))).toEqual({
        version: '1.1.1',
        unconstrained: '1.1.1',
      });
    });

    it('range degrades to the newest mature survivor (range-mature ^1 -> 1.2.0)', () => {
      expect(pickPnpmVersion('^1.0.0', pkgA, v10Policy(24))).toEqual({
        version: '1.2.0',
        unconstrained: '1.2.1',
      });
    });

    it('latest tag (too-new stable) degrades to the newest compliant stable (2.0.0 -> 1.2.0)', () => {
      expect(pickPnpmVersion('latest', pkgA, v11StrictPolicy(24))).toEqual({
        version: '1.2.0',
        unconstrained: '2.0.0',
      });
    });

    it('tag pointing at an already-mature version returns it (tag-stableold)', () => {
      expect(pickPnpmVersion('stable-old', pkgA, v10Policy(24))).toEqual({
        version: '1.0.1',
        unconstrained: '1.0.1',
      });
    });

    it('prerelease tag keeps a compliant same-line same-channel version (canary.3 -> canary.1)', () => {
      expect(pickPnpmVersion('canary', pkgA, v10Policy(24))).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('prerelease range degrades within its line (range-prerelease)', () => {
      expect(
        pickPnpmVersion('>=3.0.0-canary.1 <3.0.0-canary.9', pkgA, v10Policy(24))
      ).toEqual({
        version: '3.0.0-canary.1',
        unconstrained: '3.0.0-canary.3',
      });
    });

    it('too-new rc tag falls to its same-line beta, never into pr', () => {
      // next -> 23.0.0-rc.0 too new with no older same-line rc; the same-line
      // 23.0.0-beta.1 (lower ladder rung) wins, while the newer-published
      // internal 23.0.0-pr.5 is off the ladder and stays walled off.
      expect(pickPnpmVersion('next', pkgChannels, v11StrictPolicy(24))).toEqual(
        {
          version: '23.0.0-beta.1',
          unconstrained: '23.0.0-rc.0',
        }
      );
    });

    it('too-new rc tag keeps a compliant same-line rc (pre -> 23.1.0-rc.1)', () => {
      expect(pickPnpmVersion('pre', pkgChannels, v11StrictPolicy(24))).toEqual({
        version: '23.1.0-rc.1',
        unconstrained: '23.1.0-rc.4',
      });
    });
  });

  describe('boundary inclusivity', () => {
    it('age == window passes (exact-boundary-pass 24.2h under 24h)', () => {
      expect(pickPnpmVersion('1.0.0', pkgEdge, v10Policy(24))).toEqual({
        version: '1.0.0',
        unconstrained: '1.0.0',
      });
    });

    it('just-too-new (23.8h) exact pin -> violation (exact-boundary-fail)', () => {
      expect(() => pickPnpmVersion('1.0.1', pkgEdge, v10Policy(24))).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('v10 / strict resolution', () => {
    const policy = v10Policy(24);

    it('exact too-new pin -> NO_MATCHING_VERSION violation (exact-toonew 10.16)', () => {
      try {
        pickPnpmVersion('2.0.0', pkgA, policy);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toContain(
          'No matching version found for pkg-a@2.0.0'
        );
      }
    });

    it('range all-too-new -> violation (range-nomature pkg-b)', () => {
      expect(() => pickPnpmVersion('^1.0.0', pkgB, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });

    // 11.1.3+ strict (default 11.5.2) fails via failOnImmature with the list
    // form: count line + a `name@version was published at <iso>, within the
    // minimumReleaseAge cutoff (<iso>)` entry for the resolved pick.
    it('v11.1.3+ strict exact too-new -> failOnImmature list form (the pinned version)', () => {
      try {
        pickPnpmVersion('2.0.0', pkgA, v11StrictPolicy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        const detail = (e as MinReleaseAgeViolationError).pmShapedDetail;
        const cutoffIso = new Date(NOW - 24 * HOUR).toISOString();
        const publishedIso = new Date(NOW - 6 * HOUR).toISOString();
        expect(detail).toBe(
          '1 version does not meet the minimumReleaseAge constraint:\n' +
            `  pkg-a@2.0.0 was published at ${publishedIso}, within the minimumReleaseAge cutoff (${cutoffIso})`
        );
      }
    });

    // For a range, the 11.1.3+ resolver loose-picks the lowest in-range version,
    // so failOnImmature lists that single pick (pkg-b ^1 -> 1.0.0), not the whole
    // in-range set.
    it('v11.1.3+ strict range all-too-new -> failOnImmature lists the lowest in-range pick', () => {
      try {
        pickPnpmVersion('^1.0.0', pkgB, v11StrictPolicy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        const detail = (e as MinReleaseAgeViolationError).pmShapedDetail;
        const cutoffIso = new Date(NOW - 24 * HOUR).toISOString();
        const publishedIso = new Date(NOW - 10 * HOUR).toISOString();
        expect(detail).toBe(
          '1 version does not meet the minimumReleaseAge constraint:\n' +
            `  pkg-b@1.0.0 was published at ${publishedIso}, within the minimumReleaseAge cutoff (${cutoffIso})`
        );
      }
    });

    // 11.0.0..11.1.2 range/exact emit the single-version NO_MATURE form.
    it('v11.0.0..11.1.2 strict exact too-new -> single-version NO_MATURE form', () => {
      try {
        pickPnpmVersion('2.0.0', pkgA, v11SingleFormStrictPolicy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toMatch(
          /^Version 2\.0\.0 \(released .+ ago\) of pkg-a does not meet the minimumReleaseAge constraint$/
        );
      }
    });

    // Range on 11.0.0..11.1.2 derives immatureVersion via maxSatisfying (highest
    // in range), so the single-version NO_MATURE form names the newest blocked
    // version (pkg-b ^1 -> 1.0.1).
    it('v11.0.0..11.1.2 strict range all-too-new -> single-version NO_MATURE form (newest in range)', () => {
      try {
        pickPnpmVersion('^1.0.0', pkgB, v11SingleFormStrictPolicy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toMatch(
          /^Version 1\.0\.1 \(released .+ ago\) of pkg-b does not meet the minimumReleaseAge constraint$/
        );
      }
    });

    // 11.0.0..11.1.2 cannot derive an immatureVersion from a tag name, so a
    // too-new non-latest tag falls back to NO_MATCHING (pivot: 11.0.4..11.1.0
    // tag-nonlatest -> ERR_PNPM_NO_MATCHING_VERSION).
    it('v11.0.0..11.1.2 too-new tag with no compliant degrade -> NO_MATCHING fallback shape', () => {
      try {
        pickPnpmVersion('hot', pkgAllTooNew, v11SingleFormStrictPolicy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        const detail = (e as MinReleaseAgeViolationError).pmShapedDetail;
        expect(detail).toContain(
          'No matching version found for pkg-allnew@hot'
        );
        expect(detail).not.toContain('does not meet the minimumReleaseAge');
      }
    });

    // pnpm emits NO_MATURE only with an immature pick that has a known publish
    // time; an unknown tag has no candidate -> it falls back to NO_MATCHING.
    it('v11 strict unknown tag -> NO_MATCHING fallback shape', () => {
      try {
        pickPnpmVersion('does-not-exist', pkgA, v11StrictPolicy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        const detail = (e as MinReleaseAgeViolationError).pmShapedDetail;
        expect(detail).toContain(
          'No matching version found for pkg-a@does-not-exist'
        );
        expect(detail).not.toContain('does not meet the minimumReleaseAge');
      }
    });

    // 10.x always surfaces the NO_MATCHING shape, even for a too-new range with
    // a known publish time (no NO_MATURE code exists on v10).
    it('v10 range all-too-new -> NO_MATCHING shape (not NO_MATURE)', () => {
      try {
        pickPnpmVersion('^1.0.0', pkgB, policy);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        const detail = (e as MinReleaseAgeViolationError).pmShapedDetail;
        expect(detail).toContain('No matching version found for pkg-b@^1.0.0');
        expect(detail).not.toContain('does not meet the minimumReleaseAge');
      }
    });
  });

  describe('v11 loose least-immature fallback', () => {
    it('exact too-new pin installs immature (default-exact-toonew 11.0.0 -> 2.0.0)', () => {
      expect(pickPnpmVersion('2.0.0', pkgA, v11LoosePolicy(24))).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
        immature: true,
      });
    });

    it('range no-mature -> LOWEST in range unfiltered (default-range-nomature pkg-b ^1 -> 1.0.0)', () => {
      expect(pickPnpmVersion('^1.0.0', pkgB, v11LoosePolicy(24))).toEqual({
        version: '1.0.0',
        unconstrained: '1.0.1',
        immature: true,
      });
    });

    it('range with a mature survivor still degrades to newest mature (range-mature)', () => {
      expect(pickPnpmVersion('^1.0.0', pkgA, v11LoosePolicy(24))).toEqual({
        version: '1.2.0',
        unconstrained: '1.2.1',
      });
    });

    it('too-new tag with no compliant degrade keeps original target immature (hot -> 2.0.0)', () => {
      expect(pickPnpmVersion('hot', pkgAllTooNew, v11LoosePolicy(24))).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
        immature: true,
      });
    });

    it('tag pointing at a non-semver target -> violation, never an immature install', () => {
      // An immature return here would make the consumer write pkg@<garbage>
      // into minimumReleaseAgeExclude, which pnpm rejects on every later
      // install (ERR_PNPM_INVALID_VERSION_UNION).
      const meta: RegistryMetadata = {
        name: 'pkg-garbage',
        versions: ['1.0.0'],
        time: { '1.0.0': new Date(NOW - 9600 * HOUR).toISOString() },
        distTags: { latest: 'not-a-version' },
      };
      expect(() => pickPnpmVersion('latest', meta, v11LoosePolicy(24))).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('excludes bypass', () => {
    it('an excluded exact pin passes despite being too new (exclude-name)', () => {
      const policy = v10Policy(24, {
        isExcluded: (name, version) => name === 'pkg-a' && version === '2.0.0',
      });
      expect(pickPnpmVersion('2.0.0', pkgA, policy)).toEqual({
        version: '2.0.0',
        unconstrained: '2.0.0',
      });
    });
  });

  describe('missing time asymmetry', () => {
    it('individual missing time BLOCKS, range picks lower mature (partial-time-range -> 1.0.0)', () => {
      const meta = metadataFromAges(
        'pkg-partial-time',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeFor: ['1.1.0'] }
      );
      expect(pickPnpmVersion('^1.0.0', meta, v10Policy(24))).toEqual({
        version: '1.0.0',
        unconstrained: '1.1.0',
      });
    });

    it('whole map missing on v10 -> ERR_PNPM_MISSING_TIME violation (missing-time-tag 10.16)', () => {
      const meta = metadataFromAges(
        'pkg-no-time',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeMap: true }
      );
      try {
        pickPnpmVersion('latest', meta, v10Policy(24));
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(MinReleaseAgeViolationError);
        expect((e as MinReleaseAgeViolationError).pmShapedDetail).toContain(
          'is missing the "time" field'
        );
      }
    });

    it('whole map missing on v11 default skips the gate (missing-time-tag 11.0.0)', () => {
      const meta = metadataFromAges(
        'pkg-no-time',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeMap: true }
      );
      expect(pickPnpmVersion('latest', meta, v11LoosePolicy(24))).toEqual({
        version: '1.1.0',
        unconstrained: '1.1.0',
      });
    });

    it('whole map missing with ignoreMissingTime false -> violation (pnpm-ignore-missing-time-false)', () => {
      const meta = metadataFromAges(
        'pkg-no-time',
        { '1.0.0': 720, '1.1.0': 5 },
        { latest: '1.1.0' },
        { omitTimeMap: true }
      );
      const policy = v11LoosePolicy(24, undefined);
      (
        policy.behavior as Extract<
          PmMinReleaseAgeBehavior,
          { packageManager: 'pnpm' }
        >
      ).missingTimeMap = 'error';
      expect(() => pickPnpmVersion('latest', meta, policy)).toThrow(
        MinReleaseAgeViolationError
      );
    });
  });

  describe('readPnpmPolicy', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // readPnpmPolicy reads pnpm's resolved config via `pnpm config list --json`,
    // so mock that single spawn rather than any config surface. pnpm 11 reports
    // keys camelCase, pnpm 10 kebab-case; each test mocks the form its version
    // emits. An exclude array mirrors a yaml surface, a comma-joined string
    // mirrors .npmrc / env. pnpm itself decides which surface won.
    function mockPnpmConfig(config: Record<string, unknown> | 'throw') {
      jest
        .spyOn(require('child_process'), 'execSync')
        .mockImplementation(() => {
          if (config === 'throw') {
            throw new Error('pnpm config list failed');
          }
          return JSON.stringify(config);
        });
    }

    function pnpmBehavior(behavior: PmMinReleaseAgeBehavior) {
      return behavior as Extract<
        PmMinReleaseAgeBehavior,
        { packageManager: 'pnpm' }
      >;
    }

    it('versions below 10.16.0 -> inactive', async () => {
      const result = await readPnpmPolicy('/root', '10.15.1');
      expect(result.outcome).toBe('inactive');
    });

    it('pnpm 12+ -> ambiguous', async () => {
      const result = await readPnpmPolicy('/root', '12.0.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('unable to read pnpm config -> ambiguous (defer to install)', async () => {
      mockPnpmConfig('throw');
      const result = await readPnpmPolicy('/root', '10.16.0');
      expect(result.outcome).toBe('ambiguous');
    });

    it('v10 no cooldown configured -> inactive', async () => {
      mockPnpmConfig({});
      const result = await readPnpmPolicy('/root', '10.16.0');
      expect(result.outcome).toBe('inactive');
    });

    it('v10 window -> active strict', async () => {
      mockPnpmConfig({ 'minimum-release-age': 1440 });
      const result = await readPnpmPolicy('/root', '10.16.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(1440 * MINUTE);
        const behavior = pnpmBehavior(result.policy.behavior);
        expect(behavior.strict).toBe(true);
        expect(behavior.looseFallback).toBe(false);
        expect(behavior.missingTimeMap).toBe('error');
      }
    });

    it('zero window -> inactive', async () => {
      mockPnpmConfig({ 'minimum-release-age': 0 });
      const result = await readPnpmPolicy('/root', '10.16.0');
      expect(result.outcome).toBe('inactive');
    });

    it('negative window -> inactive', async () => {
      mockPnpmConfig({ 'minimum-release-age': -10 });
      const result = await readPnpmPolicy('/root', '10.16.0');
      expect(result.outcome).toBe('inactive');
    });

    it('v11 no explicit window -> active loose default 1440', async () => {
      mockPnpmConfig({});
      const result = await readPnpmPolicy('/root', '11.0.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(1440 * MINUTE);
        const behavior = pnpmBehavior(result.policy.behavior);
        expect(behavior.strict).toBe(false);
        expect(behavior.looseFallback).toBe(true);
      }
    });

    // The built-in 1440 default is not reported by pnpm's config (only an
    // explicitly-set window is), so the >=11.0.4 strict auto-on rule must NOT
    // fire on it - the default stays loose, the normal pnpm 11 state.
    it.each(['11.0.4', '11.1.3', '11.5.2'])(
      'v%s built-in default window stays loose (no strict auto-on)',
      async (version) => {
        mockPnpmConfig({});
        const result = await readPnpmPolicy('/root', version);
        expect(result.outcome).toBe('active');
        if (result.outcome === 'active') {
          expect(result.policy.windowMs).toBe(1440 * MINUTE);
          const behavior = pnpmBehavior(result.policy.behavior);
          expect(behavior.strict).toBe(false);
          expect(behavior.looseFallback).toBe(true);
        }
      }
    );

    it('v11 >=11.0.4 explicit window auto-enables strict', async () => {
      mockPnpmConfig({ minimumReleaseAge: 2880 });
      const result = await readPnpmPolicy('/root', '11.0.4');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        const behavior = pnpmBehavior(result.policy.behavior);
        expect(behavior.strict).toBe(true);
        expect(behavior.looseFallback).toBe(false);
      }
    });

    it('v11 >=11.0.4 explicit strict:false stays loose', async () => {
      mockPnpmConfig({
        minimumReleaseAge: 2880,
        minimumReleaseAgeStrict: false,
      });
      const result = await readPnpmPolicy('/root', '11.0.4');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(pnpmBehavior(result.policy.behavior).strict).toBe(false);
      }
    });

    it('v11.0.0 explicit window does NOT auto-enable strict', async () => {
      mockPnpmConfig({ minimumReleaseAge: 2880 });
      const result = await readPnpmPolicy('/root', '11.0.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(pnpmBehavior(result.policy.behavior).strict).toBe(false);
      }
    });

    it('v11.1.3+ writesExcludes true', async () => {
      mockPnpmConfig({ minimumReleaseAge: 1440 });
      const result = await readPnpmPolicy('/root', '11.1.3');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(pnpmBehavior(result.policy.behavior).writesExcludes).toBe(true);
      }
    });

    it('v11.1.2 writesExcludes false', async () => {
      mockPnpmConfig({ minimumReleaseAge: 1440 });
      const result = await readPnpmPolicy('/root', '11.1.2');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(pnpmBehavior(result.policy.behavior).writesExcludes).toBe(false);
      }
    });

    // pnpm reports the resolved exclude as a JSON array (set in a yaml surface).
    it('honors an exclude array from pnpm config', async () => {
      mockPnpmConfig({
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pkg-a', 'pkg-b'],
      });
      const result = await readPnpmPolicy('/root', '11.5.2');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.isExcluded('pkg-a', '2.0.0')).toBe(true);
        expect(result.policy.isExcluded('pkg-b', '1.0.0')).toBe(true);
        expect(result.policy.isExcluded('pkg-c', '1.0.0')).toBe(false);
      }
    });

    // pnpm reports the resolved exclude as a comma-joined string (set via
    // .npmrc / env). This is the ocean case: `minimum-release-age-exclude=nx,@nx/*`.
    it('honors a comma-joined exclude string from pnpm config', async () => {
      mockPnpmConfig({
        'minimum-release-age': 10080,
        'minimum-release-age-exclude': 'nx,@nx/*',
      });
      const result = await readPnpmPolicy('/root', '10.26.1');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.isExcluded('nx', '1.0.0')).toBe(true);
        expect(result.policy.isExcluded('@nx/devkit', '1.0.0')).toBe(true);
        expect(result.policy.isExcluded('other', '1.0.0')).toBe(false);
      }
    });

    // An entry pnpm's version-policy grammar rejects (a range in a version
    // union) is a version-dependent landmine; nx defers rather than crash.
    it('invalid exclude entry -> ambiguous (defer to install)', async () => {
      mockPnpmConfig({
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pkg-a@^1.0.0'],
      });
      const result = await readPnpmPolicy('/root', '11.5.2');
      expect(result.outcome).toBe('ambiguous');
    });

    it('v11 ignoreMissingTime defaults to skip; explicit false errors', async () => {
      mockPnpmConfig({ minimumReleaseAge: 1440 });
      let result = await readPnpmPolicy('/root', '11.5.2');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(pnpmBehavior(result.policy.behavior).missingTimeMap).toBe(
          'skip'
        );
      }

      mockPnpmConfig({
        minimumReleaseAge: 1440,
        minimumReleaseAgeIgnoreMissingTime: false,
      });
      result = await readPnpmPolicy('/root', '11.5.2');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(pnpmBehavior(result.policy.behavior).missingTimeMap).toBe(
          'error'
        );
      }
    });

    // pnpm 11 reports config keys camelCase via `config list --json`; pnpm 10
    // reported them kebab-case. Reading only the kebab form dropped every
    // explicitly-set value on pnpm 11, so the window fell back to the built-in
    // 1440 default (gh-36330).
    it('honors a camelCase window from pnpm 11 (auto-enables strict)', async () => {
      mockPnpmConfig({ minimumReleaseAge: 60 });
      const result = await readPnpmPolicy('/root', '11.13.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(60 * MINUTE);
        const behavior = pnpmBehavior(result.policy.behavior);
        expect(behavior.strict).toBe(true);
        expect(behavior.looseFallback).toBe(false);
      }
    });

    it('honors camelCase exclude, strict, and ignoreMissingTime from pnpm 11', async () => {
      mockPnpmConfig({
        minimumReleaseAge: 2880,
        minimumReleaseAgeExclude: ['pkg-a'],
        minimumReleaseAgeStrict: false,
        minimumReleaseAgeIgnoreMissingTime: false,
      });
      const result = await readPnpmPolicy('/root', '11.13.0');
      expect(result.outcome).toBe('active');
      if (result.outcome === 'active') {
        expect(result.policy.windowMs).toBe(2880 * MINUTE);
        expect(result.policy.isExcluded('pkg-a', '2.0.0')).toBe(true);
        const behavior = pnpmBehavior(result.policy.behavior);
        expect(behavior.strict).toBe(false);
        expect(behavior.missingTimeMap).toBe('error');
      }
    });
  });

  describe('NO_MATURE release-age wording (pnpm v11 formatTimeAgo buckets)', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function detailFor(ageHours: number, windowHours: number): string {
      const metadata = metadataFromAges(
        'pkg-t',
        { '1.0.0': ageHours },
        { latest: '1.0.0' }
      );
      try {
        // The 'released X ago' wording lives only in the 11.0.0..11.1.2
        // single-version NO_MATURE form.
        pickPnpmVersion(
          '1.0.0',
          metadata,
          v11SingleFormStrictPolicy(windowHours)
        );
      } catch (e) {
        return (e as MinReleaseAgeViolationError).pmShapedDetail;
      }
      throw new Error('expected violation');
    }

    it('uses minutes under 90 minutes', () => {
      expect(detailFor(89 / 60, 24)).toContain('released 89 minutes ago');
    });

    it('uses hours from 90 minutes to 48 hours', () => {
      expect(detailFor(47, 72)).toContain('released 47 hours ago');
    });

    it('uses days from 48 hours', () => {
      expect(detailFor(49, 72)).toContain('released 2 days ago');
    });

    it("uses 'just now' under a minute", () => {
      expect(detailFor(0.5 / 60, 24)).toContain('released just now');
    });
  });

  describe('exclude grammar (via readPnpmPolicy.isExcluded)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    async function excludeFor(version: string, doc: Record<string, unknown>) {
      // pnpm reports a yaml-set exclude as a JSON array via `config list --json`.
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue(
        JSON.stringify({
          'minimum-release-age': doc.minimumReleaseAge,
          'minimum-release-age-exclude': doc.minimumReleaseAgeExclude,
        })
      );
      const result = await readPnpmPolicy('/root', version);
      if (result.outcome !== 'active') {
        return result.outcome;
      }
      return result.policy.isExcluded;
    }

    it('v1 (10.16) matches exact names only, ignores version specs', async () => {
      const isExcluded = await excludeFor('10.16.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pkg-a', 'pkg-b@2.0.0'],
      });
      expect(typeof isExcluded).toBe('function');
      if (typeof isExcluded === 'function') {
        expect(isExcluded('pkg-a', '9.9.9')).toBe(true);
        // 'pkg-b@2.0.0' is a literal name in v1, never matches the bare name.
        expect(isExcluded('pkg-b', '2.0.0')).toBe(false);
      }
    });

    it('v2 (10.19) name globs are case-sensitive', async () => {
      const isExcluded = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['@scope/*'],
      });
      if (typeof isExcluded === 'function') {
        expect(isExcluded('@scope/pkg-c', '1.0.0')).toBe(true);
        expect(isExcluded('@Scope/pkg-c', '1.0.0')).toBe(false);
        expect(isExcluded('@other/pkg-c', '1.0.0')).toBe(false);
      }
    });

    it('v2 negation (!) inverts the match', async () => {
      const isExcluded = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['!pkg-a'],
      });
      if (typeof isExcluded === 'function') {
        expect(isExcluded('pkg-a', '1.0.0')).toBe(false);
        expect(isExcluded('pkg-b', '1.0.0')).toBe(true);
      }
    });

    // @pnpm/config.version-policy builds one matcher per pattern and returns on
    // the FIRST matching rule (evaluateVersionPolicy). A '!' becomes a per-rule
    // "match anything but this name", so it never vetoes a prior include the way
    // @pnpm/matcher's whole-array negation does. Both orderings below exclude
    // pkg-a (verified against config/version-policy/src/index.ts).
    it('v2 include then negate still excludes (first-rule-wins)', async () => {
      const isExcluded = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pkg-a', '!pkg-a'],
      });
      if (typeof isExcluded === 'function') {
        // rule 0 ('pkg-a') matches first -> excluded.
        expect(isExcluded('pkg-a', '1.0.0')).toBe(true);
      }
    });

    it('v2 negate then include excludes via the later include', async () => {
      const isExcluded = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['!pkg-a', 'pkg-a'],
      });
      if (typeof isExcluded === 'function') {
        // rule 0 ('!pkg-a') skips pkg-a, rule 1 ('pkg-a') matches -> excluded.
        expect(isExcluded('pkg-a', '1.0.0')).toBe(true);
        // '!pkg-a' (rule 0) matches everything else first -> excluded too.
        expect(isExcluded('pkg-b', '1.0.0')).toBe(true);
      }
    });

    it('v2 exact-version union excludes only the listed versions', async () => {
      const isExcluded = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pkg-a@1.2.3||1.4.5'],
      });
      if (typeof isExcluded === 'function') {
        expect(isExcluded('pkg-a', '1.2.3')).toBe(true);
        expect(isExcluded('pkg-a', '1.4.5')).toBe(true);
        expect(isExcluded('pkg-a', '2.0.0')).toBe(false);
      }
    });

    it('v2 scoped exact-version union resolves the version delimiter correctly', async () => {
      const isExcluded = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['@scope/pkg-c@1.1.0'],
      });
      if (typeof isExcluded === 'function') {
        expect(isExcluded('@scope/pkg-c', '1.1.0')).toBe(true);
        expect(isExcluded('@scope/pkg-c', '1.0.0')).toBe(false);
      }
    });

    it('v2 invalid version union -> ambiguous', async () => {
      const outcome = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pkg-a@^1.0.0'],
      });
      expect(outcome).toBe('ambiguous');
    });

    it('v2 name pattern with a version union -> ambiguous', async () => {
      const outcome = await excludeFor('10.19.0', {
        minimumReleaseAge: 1440,
        minimumReleaseAgeExclude: ['pk*@1.2.3'],
      });
      expect(outcome).toBe('ambiguous');
    });
  });
});
