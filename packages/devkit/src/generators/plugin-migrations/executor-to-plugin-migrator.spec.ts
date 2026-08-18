import type { TargetDefaults } from 'nx/src/devkit-exports';
import { readTargetDefaultsForExecutor } from './executor-to-plugin-migrator';

describe('readTargetDefaultsForExecutor', () => {
  it('reads the exact executor-keyed default from legacy record-shaped targetDefaults', () => {
    const targetDefaults: TargetDefaults = {
      '@nx/example:build': {
        cache: true,
        dependsOn: ['^build'],
      },
      build: {
        executor: '@nx/example:build',
        cache: false,
      },
    };

    expect(
      readTargetDefaultsForExecutor('@nx/example:build', targetDefaults)
    ).toEqual({
      cache: true,
      dependsOn: ['^build'],
    });
  });

  it('reads the unfiltered executor entry from an executor-keyed default', () => {
    const targetDefaults: TargetDefaults = {
      '@nx/example:test': {
        inputs: ['default', '^default'],
      },
    };

    expect(
      readTargetDefaultsForExecutor('@nx/example:test', targetDefaults)
    ).toEqual({
      inputs: ['default', '^default'],
    });
  });

  it('does not broaden to target-scoped or filtered entries', () => {
    const targetDefaults: TargetDefaults = {
      build: [
        {
          filter: { executor: '@nx/example:build' },
          cache: false,
        },
      ],
      '@nx/example:build': [
        {
          filter: { projects: ['app'] },
          cache: true,
        },
      ],
    };

    expect(
      readTargetDefaultsForExecutor('@nx/example:build', targetDefaults)
    ).toBeUndefined();
  });
});
