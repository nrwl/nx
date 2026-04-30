import {
  findTargetDefaultEntry,
  isTargetDefaultsArray,
  normalizeTargetDefaults,
} from './normalize-target-defaults';

describe('normalizeTargetDefaults', () => {
  it('returns [] for undefined', () => {
    expect(normalizeTargetDefaults(undefined)).toEqual([]);
  });

  it('returns a shallow copy of an array shape', () => {
    const input = [{ target: 'test' as const, cache: true }];
    const out = normalizeTargetDefaults(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('converts record shape preserving insertion order', () => {
    expect(
      normalizeTargetDefaults({
        build: { cache: true },
        'e2e-ci--*': { dependsOn: ['build'] },
        '@nx/vite:test': { inputs: ['default'] },
      })
    ).toEqual([
      { target: 'build', cache: true },
      { target: 'e2e-ci--*', dependsOn: ['build'] },
      { target: '@nx/vite:test', inputs: ['default'] },
    ]);
  });

  it('tolerates empty record entries', () => {
    expect(
      normalizeTargetDefaults({
        build: undefined as any,
        lint: null as any,
      })
    ).toEqual([{ target: 'build' }, { target: 'lint' }]);
  });
});

describe('isTargetDefaultsArray', () => {
  it('returns true for arrays', () => {
    expect(isTargetDefaultsArray([])).toBe(true);
    expect(isTargetDefaultsArray([{ target: 'a' }])).toBe(true);
  });

  it('returns false for record or undefined', () => {
    expect(isTargetDefaultsArray({})).toBe(false);
    expect(isTargetDefaultsArray({ build: { cache: true } })).toBe(false);
    expect(isTargetDefaultsArray(undefined)).toBe(false);
  });
});

describe('findTargetDefaultEntry', () => {
  it('returns undefined when target defaults absent', () => {
    expect(
      findTargetDefaultEntry(undefined, { target: 'test' })
    ).toBeUndefined();
  });

  it('finds an entry in the array shape by target only', () => {
    expect(
      findTargetDefaultEntry(
        [
          { target: 'build', cache: true },
          { target: 'test', cache: false },
        ],
        { target: 'test' }
      )
    ).toEqual({ target: 'test', cache: false });
  });

  it('distinguishes array entries by projects filter', () => {
    const entries = [
      { target: 'test' as const, cache: true },
      { target: 'test' as const, projects: 'web', inputs: ['x'] },
    ];
    expect(findTargetDefaultEntry(entries, { target: 'test' })).toEqual(
      entries[0]
    );
    expect(
      findTargetDefaultEntry(entries, { target: 'test', projects: 'web' })
    ).toEqual(entries[1]);
  });

  it('distinguishes array entries by source filter', () => {
    const entries = [
      { target: 'test' as const, cache: true },
      { target: 'test' as const, source: '@nx/vite', inputs: ['v'] },
    ];
    expect(
      findTargetDefaultEntry(entries, { target: 'test', source: '@nx/vite' })
    ).toEqual(entries[1]);
  });

  it('returns the unfiltered record entry when no filters requested', () => {
    expect(
      findTargetDefaultEntry({ build: { cache: true } }, { target: 'build' })
    ).toEqual({ target: 'build', cache: true });
  });

  it('returns undefined when record is consulted with filters', () => {
    expect(
      findTargetDefaultEntry(
        { build: { cache: true } },
        { target: 'build', projects: 'web' }
      )
    ).toBeUndefined();
  });

  it('compares arrays of projects by shallow equality', () => {
    const entries = [
      {
        target: 'test' as const,
        projects: ['a', 'b'],
        inputs: ['x'],
      },
    ];
    expect(
      findTargetDefaultEntry(entries, {
        target: 'test',
        projects: ['a', 'b'],
      })
    ).toEqual(entries[0]);
    expect(
      findTargetDefaultEntry(entries, {
        target: 'test',
        projects: ['b', 'a'],
      })
    ).toBeUndefined();
  });
});
