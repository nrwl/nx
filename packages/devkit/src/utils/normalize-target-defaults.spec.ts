import { normalizeTargetDefaults } from './normalize-target-defaults';

describe('normalizeTargetDefaults', () => {
  it('returns [] for undefined', () => {
    expect(normalizeTargetDefaults(undefined)).toEqual([]);
  });

  it('returns the array shape unchanged (no clone)', () => {
    const input = [{ target: 'test' as const, cache: true }];
    const out = normalizeTargetDefaults(input);
    expect(out).toBe(input);
  });

  it('converts record shape preserving insertion order, splitting executor keys', () => {
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

  it('tolerates empty record entries', () => {
    expect(
      normalizeTargetDefaults({
        build: undefined as any,
        lint: null as any,
      })
    ).toEqual([{ target: 'build' }, { target: 'lint' }]);
  });
});
