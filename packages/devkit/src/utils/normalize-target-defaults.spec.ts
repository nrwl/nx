import {
  denormalizeTargetDefaults,
  normalizeTargetDefaults,
} from './normalize-target-defaults';

describe('normalizeTargetDefaults (nested map -> flat logical entries)', () => {
  it('returns [] for undefined', () => {
    expect(normalizeTargetDefaults(undefined)).toEqual([]);
  });

  it('expands object values, classifying executor-shaped keys', () => {
    expect(
      normalizeTargetDefaults({
        build: { cache: true },
        'e2e-ci--*': { dependsOn: ['build'] },
        '@nx/vite:test': { inputs: ['default'] },
        'nx:run-commands': { cache: false },
      })
    ).toEqual([
      { target: 'build', cache: true },
      { target: 'e2e-ci--*', dependsOn: ['build'] },
      { executor: '@nx/vite:test', inputs: ['default'] },
      { executor: 'nx:run-commands', cache: false },
    ]);
  });

  it('expands array values, un-nesting the filter into flat siblings', () => {
    expect(
      normalizeTargetDefaults({
        test: [
          { cache: false },
          {
            filter: { plugin: '@nx/vite', projects: ['tag:vite'] },
            inputs: ['vite.config.ts'],
          },
          { filter: { executor: '@nx/jest:jest' }, inputs: ['jest.config.ts'] },
        ],
      })
    ).toEqual([
      { target: 'test', cache: false },
      {
        target: 'test',
        plugin: '@nx/vite',
        projects: ['tag:vite'],
        inputs: ['vite.config.ts'],
      },
      { target: 'test', executor: '@nx/jest:jest', inputs: ['jest.config.ts'] },
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

describe('denormalizeTargetDefaults (flat logical entries -> nested map)', () => {
  it('writes a lone unfiltered entry as the plain object form', () => {
    expect(
      denormalizeTargetDefaults([{ target: 'build', cache: true }])
    ).toEqual({ build: { cache: true } });
  });

  it('keeps an executor-only entry as an executor key (object form)', () => {
    expect(
      denormalizeTargetDefaults([
        { executor: '@nx/js:tsc', inputs: ['default'] },
      ])
    ).toEqual({ '@nx/js:tsc': { inputs: ['default'] } });
  });

  it('groups multiple entries for one key into the ordered array form', () => {
    expect(
      denormalizeTargetDefaults([
        { target: 'test', cache: false },
        { target: 'test', plugin: '@nx/vite', inputs: ['vite.config.ts'] },
      ])
    ).toEqual({
      test: [
        { cache: false },
        { filter: { plugin: '@nx/vite' }, inputs: ['vite.config.ts'] },
      ],
    });
  });

  it('keeps an executor used alongside a target as a config field (object form)', () => {
    expect(
      denormalizeTargetDefaults([
        {
          target: 'test',
          executor: '@nx/jest:jest',
          inputs: ['jest.config.ts'],
        },
      ])
    ).toEqual({
      test: { executor: '@nx/jest:jest', inputs: ['jest.config.ts'] },
    });
  });

  it('round-trips through normalize without loss', () => {
    const map = {
      build: { cache: true },
      test: [
        { cache: false },
        { filter: { plugin: '@nx/vite' }, inputs: ['vite.config.ts'] },
      ],
    };
    expect(denormalizeTargetDefaults(normalizeTargetDefaults(map))).toEqual(
      map
    );
  });

  it('throws on an entry with neither target nor executor', () => {
    expect(() => denormalizeTargetDefaults([{ cache: true } as any])).toThrow(
      /neither `target` nor `executor`/
    );
  });
});
