import type { RegistryMetadata } from './packument';
import { classifySpec, isVersionMature } from './pick';
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
