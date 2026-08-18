import type { RegistryMetadata } from './packument';
import { classifySpec, degradeTagToCompliant, isVersionMature } from './pick';
import type { MinReleaseAgePolicy } from './policy';

describe('classifySpec', () => {
  it('classifies exact semver pins', () => {
    expect(classifySpec('1.2.3')).toBe('exact');
    expect(classifySpec('1.2.3-canary.1')).toBe('exact');
  });

  it('classifies ranges', () => {
    expect(classifySpec('^1.0.0')).toBe('range');
    expect(classifySpec('>=1.0.0 <2.0.0')).toBe('range');
    expect(classifySpec('1.x')).toBe('range');
    expect(classifySpec('*')).toBe('range');
  });

  it('classifies anything else as a tag', () => {
    expect(classifySpec('latest')).toBe('tag');
    expect(classifySpec('canary')).toBe('tag');
    expect(classifySpec('next')).toBe('tag');
  });
});

describe('isVersionMature', () => {
  const cutoffMs = Date.parse('2026-06-04T00:00:00.000Z');
  const policy = {
    cutoffMs,
    isExcluded: () => false,
  } as unknown as MinReleaseAgePolicy;

  const metadata: RegistryMetadata = {
    name: 'pkg-a',
    versions: ['1.0.0', '1.1.0', '1.2.0'],
    time: {
      '1.0.0': '2026-06-01T00:00:00.000Z',
      '1.1.0': '2026-06-05T00:00:00.000Z',
    },
    distTags: { latest: '1.2.0' },
  };

  it('passes a version published at or before the cutoff', () => {
    expect(isVersionMature('pkg-a', '1.0.0', metadata, policy)).toBe(true);
  });

  it('blocks a version published after the cutoff', () => {
    expect(isVersionMature('pkg-a', '1.1.0', metadata, policy)).toBe(false);
  });

  it('passes a version missing an individual time entry (npm/bun default)', () => {
    expect(isVersionMature('pkg-a', '1.2.0', metadata, policy)).toBe(true);
  });

  it('passes an excluded version regardless of age', () => {
    const excluding = {
      cutoffMs,
      isExcluded: (name: string, version: string) =>
        name === 'pkg-a' && version === '1.1.0',
    } as unknown as MinReleaseAgePolicy;
    expect(isVersionMature('pkg-a', '1.1.0', metadata, excluding)).toBe(true);
  });
});

describe('degradeTagToCompliant', () => {
  const metadata: RegistryMetadata = {
    name: 'pkg-a',
    versions: [
      '22.7.0',
      '22.7.5',
      '22.7.0-rc.2',
      '23.0.0-beta.1',
      '23.0.0-pr.5',
      '23.0.0-rc.0',
      '23.1.0-rc.1',
      '23.1.0-rc.4',
    ],
    time: null,
    distTags: {},
  };
  // Everything except the two newest-line release candidates and 22.7.5.
  const compliant = (version: string): boolean =>
    !['22.7.5', '23.0.0-rc.0', '23.1.0-rc.4'].includes(version);

  it('degrades a stable target to the newest compliant stable', () => {
    expect(degradeTagToCompliant('22.7.5', metadata, compliant)).toBe('22.7.0');
  });

  it('excludes prereleases entirely for a stable target', () => {
    // Only a prerelease BELOW the stable target is compliant: it survives the
    // newer-than-target cut, so only the channel rule keeps it out of the pool.
    const onlyPre = (v: string) => v === '22.7.0-rc.2';
    expect(degradeTagToCompliant('22.7.5', metadata, onlyPre)).toBeNull();
  });

  it('falls from a blocked rc to a same-line beta, never into pr', () => {
    // 23.0.0-rc.0 has no older same-line rc sibling; beta sits on a lower
    // ladder rung of the same line, so 23.0.0-beta.1 wins. The internal
    // 23.0.0-pr.5 is off the ladder and stays walled off.
    expect(degradeTagToCompliant('23.0.0-rc.0', metadata, compliant)).toBe(
      '23.0.0-beta.1'
    );
  });

  it('drops to the common pool when no same-line ladder candidate is compliant', () => {
    // With the same-line beta also blocked, the only same-channel candidate
    // (the cross-line 22.7.0-rc.2) loses to the stable 22.7.0.
    const withoutBeta = (v: string) => compliant(v) && v !== '23.0.0-beta.1';
    expect(degradeTagToCompliant('23.0.0-rc.0', metadata, withoutBeta)).toBe(
      '22.7.0'
    );
  });

  it('returns null when only an off-ladder channel is compliant', () => {
    // pr has no place on the ladder, so it never enters the pool even as the
    // sole compliant version below the target.
    const onlyPr = (v: string) => v === '23.0.0-pr.5';
    expect(degradeTagToCompliant('23.0.0-rc.0', metadata, onlyPr)).toBeNull();
  });

  it('never climbs the ladder: a beta target ignores a lower rc', () => {
    // 22.0.0-rc.1 is below the target by semver but on a HIGHER rung; the
    // ladder only permits descent, so nothing qualifies.
    const meta: RegistryMetadata = {
      name: 'pkg-climb',
      versions: ['22.0.0-rc.1', '23.0.0-beta.0', '23.0.0-beta.1'],
      time: null,
      distTags: {},
    };
    const onlyRc = (v: string) => v === '22.0.0-rc.1';
    expect(degradeTagToCompliant('23.0.0-beta.1', meta, onlyRc)).toBeNull();
  });

  it('treats next as off-ladder (rolling snapshot in some ecosystems)', () => {
    const meta: RegistryMetadata = {
      name: 'pkg-next',
      versions: ['23.0.0-next.3', '23.0.0-rc.0'],
      time: null,
      distTags: {},
    };
    const onlyNext = (v: string) => v === '23.0.0-next.3';
    expect(degradeTagToCompliant('23.0.0-rc.0', meta, onlyNext)).toBeNull();
  });

  it('prefers a same-line lower-rung beta over a newer-published cross-line stable', () => {
    // The stable backport was published after the beta, so publish-date order
    // alone would pick it; the same-line tier must outrank publish recency.
    const meta: RegistryMetadata = {
      name: 'pkg-tier',
      versions: ['22.7.0', '23.0.0-beta.1', '23.0.0-rc.0'],
      time: {
        '23.0.0-beta.1': '2026-06-01T00:00:00.000Z',
        '22.7.0': '2026-06-08T00:00:00.000Z',
        '23.0.0-rc.0': '2026-06-10T00:00:00.000Z',
      },
      distTags: {},
    };
    const compliantByDate = (v: string) => v !== '23.0.0-rc.0';
    expect(degradeTagToCompliant('23.0.0-rc.0', meta, compliantByDate)).toBe(
      '23.0.0-beta.1'
    );
  });

  it('prefers a compliant same-line same-channel prerelease over stable', () => {
    expect(degradeTagToCompliant('23.1.0-rc.4', metadata, compliant)).toBe(
      '23.1.0-rc.1'
    );
  });

  it('returns null when nothing in the pool is compliant', () => {
    expect(degradeTagToCompliant('22.7.5', metadata, () => false)).toBeNull();
  });

  it('returns null for a non-semver target instead of throwing', () => {
    expect(
      degradeTagToCompliant('not-a-version', metadata, () => true)
    ).toBeNull();
  });

  it('skips non-semver junk in the versions list instead of throwing', () => {
    const junk: RegistryMetadata = {
      name: 'pkg-junk',
      versions: ['created', '1.0.0', '1.1.0'],
      time: null,
      distTags: {},
    };
    expect(degradeTagToCompliant('1.1.0', junk, (v) => v === '1.0.0')).toBe(
      '1.0.0'
    );
  });

  it('orders the pool by publish date, newest released first', () => {
    // 1.9.5 is a backport published after 1.10.0, so it wins despite the lower
    // version - the pool is ordered by release date, not semver.
    const dated: RegistryMetadata = {
      name: 'pkg-b',
      versions: ['1.9.0', '1.10.0', '1.9.5', '2.0.0'],
      time: {
        '1.9.0': '2026-01-01T00:00:00.000Z',
        '1.10.0': '2026-06-01T00:00:00.000Z',
        '1.9.5': '2026-06-10T00:00:00.000Z',
        '2.0.0': '2026-06-11T00:00:00.000Z',
      },
      distTags: {},
    };
    // The too-new target is the only non-compliant version.
    const compliantByDate = (v: string): boolean => v !== '2.0.0';
    expect(degradeTagToCompliant('2.0.0', dated, compliantByDate)).toBe(
      '1.9.5'
    );
  });

  it('exhausts same-line prereleases before the common pool, even when a stable shipped between them', () => {
    // 22.9.5 was published after 23.0.0-rc.1 but before the too-new
    // 23.0.0-rc.2. rc.1 must still win: every same-line rc.* is tried before
    // any stable enters consideration, so the newer-published stable can't jump
    // ahead.
    const meta: RegistryMetadata = {
      name: 'pkg-c',
      versions: ['22.9.0', '22.9.5', '23.0.0-rc.1', '23.0.0-rc.2'],
      time: {
        '22.9.0': '2026-05-20T00:00:00.000Z',
        '23.0.0-rc.1': '2026-06-01T00:00:00.000Z',
        '22.9.5': '2026-06-05T00:00:00.000Z',
        '23.0.0-rc.2': '2026-06-10T00:00:00.000Z',
      },
      distTags: {},
    };
    // Only the too-new target rc.2 is non-compliant.
    const compliant = (v: string): boolean => v !== '23.0.0-rc.2';
    expect(degradeTagToCompliant('23.0.0-rc.2', meta, compliant)).toBe(
      '23.0.0-rc.1'
    );
  });
});
