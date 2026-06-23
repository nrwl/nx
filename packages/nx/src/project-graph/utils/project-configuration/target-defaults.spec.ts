import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import {
  createTargetDefaultsResults,
  getUnfilteredTargetDefault,
  normalizeTargetDefaults,
  readTargetDefaultsForTarget,
} from './target-defaults';

function node(
  name: string,
  opts: { root?: string; tags?: string[] } = {}
): ProjectGraphProjectNode {
  return {
    name,
    type: 'lib',
    data: { root: opts.root ?? name, tags: opts.tags ?? [] },
  } as ProjectGraphProjectNode;
}

describe('normalizeTargetDefaults', () => {
  it('returns an empty map for undefined', () => {
    expect(normalizeTargetDefaults(undefined)).toEqual({});
  });

  it('wraps a bare object value into a single catch-all entry', () => {
    expect(normalizeTargetDefaults({ build: { cache: true } })).toEqual({
      build: [{ cache: true }],
    });
  });

  it('passes an array value through unchanged', () => {
    const input = {
      test: [
        { cache: false },
        { filter: { plugin: '@nx/vite' }, inputs: ['a'] },
      ],
    };
    expect(normalizeTargetDefaults(input).test).toEqual(input.test);
  });

  it('treats object and single-element array as equivalent', () => {
    expect(normalizeTargetDefaults({ test: { cache: false } })).toEqual(
      normalizeTargetDefaults({ test: [{ cache: false }] })
    );
  });
});

describe('readTargetDefaultsForTarget (nested-array)', () => {
  it('reads the object value form by exact target name', () => {
    expect(
      readTargetDefaultsForTarget('build', { build: { cache: true } })
    ).toEqual({ cache: true });
  });

  it('returns null when no key matches', () => {
    expect(
      readTargetDefaultsForTarget('lint', { build: { cache: true } })
    ).toBeNull();
  });

  describe('inner accumulate-and-merge', () => {
    const targetDefaults = {
      test: [
        { cache: true, inputs: ['default'] },
        { filter: { plugin: '@nx/vite' }, inputs: ['vite.config.ts'] },
        { filter: { plugin: '@nx/jest' }, inputs: ['jest.config.ts'] },
        { cache: false },
      ],
    };

    it('applies only the catch-alls without plugin context (merging in order, last wins)', () => {
      // Both filter-less entries match; the trailing `{ cache: false }`
      // overrides the leading `{ cache: true }`.
      expect(readTargetDefaultsForTarget('test', targetDefaults)).toEqual({
        cache: false,
        inputs: ['default'],
      });
    });

    it('layers a matching plugin-filtered entry on top of the catch-alls', () => {
      expect(
        readTargetDefaultsForTarget('test', targetDefaults, undefined, {
          sourcePlugin: '@nx/vite',
        })
      ).toEqual({ cache: false, inputs: ['vite.config.ts'] });
    });

    it('selects the jest entry for a jest-attributed target', () => {
      expect(
        readTargetDefaultsForTarget('test', targetDefaults, undefined, {
          sourcePlugin: '@nx/jest',
        })
      ).toEqual({ cache: false, inputs: ['jest.config.ts'] });
    });
  });

  it('matches a projects filter against the project node', () => {
    const targetDefaults = {
      test: [
        { cache: true },
        {
          filter: { projects: ['tag:test-runner:vite'] },
          inputs: ['vite.config.ts'],
        },
      ],
    };
    const matched = readTargetDefaultsForTarget(
      'test',
      targetDefaults,
      undefined,
      {
        projectName: 'app',
        projectNode: node('app', { tags: ['test-runner:vite'] }),
      }
    );
    expect(matched).toEqual({ cache: true, inputs: ['vite.config.ts'] });

    const notMatched = readTargetDefaultsForTarget(
      'test',
      targetDefaults,
      undefined,
      {
        projectName: 'app',
        projectNode: node('app', { tags: ['test-runner:jest'] }),
      }
    );
    expect(notMatched).toEqual({ cache: true });
  });

  it('matches a filter.executor against the resolved executor', () => {
    const targetDefaults = {
      test: [
        { cache: true },
        { filter: { executor: '@nx/jest:jest' }, inputs: ['jest.config.ts'] },
      ],
    };
    expect(
      readTargetDefaultsForTarget('test', targetDefaults, '@nx/jest:jest')
    ).toEqual({ cache: true, inputs: ['jest.config.ts'] });
    expect(
      readTargetDefaultsForTarget('test', targetDefaults, '@nx/vite:test')
    ).toEqual({ cache: true });
  });

  describe('outer key precedence', () => {
    it('prefers the executor key over the exact name key', () => {
      const targetDefaults = {
        test: { cache: false },
        '@nx/jest:jest': { cache: true, inputs: ['jest'] },
      };
      expect(
        readTargetDefaultsForTarget('test', targetDefaults, '@nx/jest:jest')
      ).toEqual({ cache: true, inputs: ['jest'] });
    });

    it('falls back to the exact name key when there is no executor key', () => {
      const targetDefaults = { test: { cache: false } };
      expect(
        readTargetDefaultsForTarget('test', targetDefaults, '@nx/jest:jest')
      ).toEqual({ cache: false });
    });

    it('matches a glob key and prefers the longest glob', () => {
      const targetDefaults = {
        'e2e-ci--*': { cache: true },
        'e2e-*': { cache: false },
      };
      expect(
        readTargetDefaultsForTarget('e2e-ci--file', targetDefaults)
      ).toEqual({ cache: true });
    });

    it('falls through to a glob key when the exact key has no matching entry', () => {
      const targetDefaults = {
        test: [{ filter: { plugin: '@nx/vite' }, inputs: ['vite'] }],
        't*': { cache: true },
      };
      // No vite context → the exact `test` key yields nothing, so the glob
      // catch-all applies.
      expect(readTargetDefaultsForTarget('test', targetDefaults)).toEqual({
        cache: true,
      });
    });
  });
});

describe('getUnfilteredTargetDefault', () => {
  it('returns {} for undefined', () => {
    expect(getUnfilteredTargetDefault(undefined)).toEqual({});
  });

  it('returns the object value as-is', () => {
    expect(getUnfilteredTargetDefault({ dependsOn: ['^build'] })).toEqual({
      dependsOn: ['^build'],
    });
  });

  it('returns the filter-less entry of an array value, stripped of filter', () => {
    expect(
      getUnfilteredTargetDefault([
        { dependsOn: ['^build'] },
        { filter: { plugin: '@nx/vite' }, cache: true },
      ])
    ).toEqual({ dependsOn: ['^build'] });
  });

  it('returns {} when an array value has no catch-all entry', () => {
    expect(
      getUnfilteredTargetDefault([
        { filter: { plugin: '@nx/vite' }, cache: true },
      ])
    ).toEqual({});
  });
});

describe('createTargetDefaultsResults (plugin filter)', () => {
  // Drives the real source-map attribution path (`resolveSourcePlugin`) rather
  // than injecting `sourcePlugin` directly, so it would catch a regression in
  // the source-map key the matcher reads the source plugin from.
  it('applies a plugin-filtered default when the target is attributed to that plugin', () => {
    const defaultRootMap = {
      'apps/app': {
        root: 'apps/app',
        targets: { build: { executor: '@nx/vite:build', options: {} } },
      },
    };
    const defaultSourceMaps = {
      'apps/app': {
        'targets.build.executor': ['vite.config.ts', '@nx/vite/plugin'] as [
          string,
          string,
        ],
      },
    };
    const nxJson = {
      targetDefaults: {
        build: [
          { filter: { plugin: '@nx/vite/plugin' }, options: { foo: 'bar' } },
          { filter: { plugin: '@nx/webpack/plugin' }, options: { foo: 'baz' } },
        ],
      },
    };

    const results = createTargetDefaultsResults(
      {},
      defaultRootMap,
      nxJson as any,
      undefined,
      defaultSourceMaps
    );

    const synthetic = results[0]?.[2]?.projects?.['apps/app']?.targets?.build;
    expect(synthetic?.options).toEqual({ foo: 'bar' });
  });

  it('does not apply a plugin-filtered default when the plugin does not match', () => {
    const defaultRootMap = {
      'apps/app': {
        root: 'apps/app',
        targets: { build: { executor: '@nx/vite:build', options: {} } },
      },
    };
    const defaultSourceMaps = {
      'apps/app': {
        'targets.build.executor': ['vite.config.ts', '@nx/vite/plugin'] as [
          string,
          string,
        ],
      },
    };
    const nxJson = {
      targetDefaults: {
        build: [
          { filter: { plugin: '@nx/webpack/plugin' }, options: { foo: 'baz' } },
        ],
      },
    };

    const results = createTargetDefaultsResults(
      {},
      defaultRootMap,
      nxJson as any,
      undefined,
      defaultSourceMaps
    );

    expect(results).toEqual([]);
  });
});

describe('createTargetDefaultsResults (source attribution)', () => {
  it('emits one synthetic result per resolving key with a key-specific file', () => {
    const defaultRootMap = {
      'apps/app': {
        root: 'apps/app',
        targets: {
          build: { executor: '@nx/js:tsc', options: {} },
          test: { executor: '@nx/jest:jest', options: {} },
        },
      },
    };
    const nxJson = {
      targetDefaults: {
        // resolves for `build` via the target-name key
        build: { cache: true },
        // resolves for `test` via the executor key
        '@nx/jest:jest': { cache: true },
      },
    };

    const results = createTargetDefaultsResults(
      {},
      defaultRootMap,
      nxJson as any
    );

    // The `file` reuses nx.json as a location id pointing at the originating
    // `targetDefaults` key, so attribution is per-key rather than whole-file.
    const byFile = Object.fromEntries(results.map((r) => [r[1], r[2]]));
    expect(Object.keys(byFile).sort()).toEqual([
      'nx.json#targetDefaults.@nx/jest:jest',
      'nx.json#targetDefaults.build',
    ]);
    expect(
      byFile['nx.json#targetDefaults.build'].projects['apps/app'].targets.build
        .cache
    ).toBe(true);
    expect(
      byFile['nx.json#targetDefaults.@nx/jest:jest'].projects['apps/app']
        .targets.test.cache
    ).toBe(true);
  });

  it('emits one result per matching array element with an indexed file', () => {
    const defaultRootMap = {
      'apps/app': {
        root: 'apps/app',
        targets: { build: { executor: '@nx/vite:build', options: {} } },
      },
    };
    const defaultSourceMaps = {
      'apps/app': {
        'targets.build.executor': ['vite.config.ts', '@nx/vite/plugin'] as [
          string,
          string,
        ],
      },
    };
    const nxJson = {
      targetDefaults: {
        build: [
          { cache: true },
          { filter: { plugin: '@nx/vite/plugin' }, inputs: ['vite.config.ts'] },
        ],
      },
    };

    const results = createTargetDefaultsResults(
      {},
      defaultRootMap,
      nxJson as any,
      undefined,
      defaultSourceMaps
    );

    // Both the catch-all (index 0) and the matching plugin-filtered entry
    // (index 1) apply, so each becomes its own result attributed to its element.
    const byFile = Object.fromEntries(results.map((r) => [r[1], r[2]]));
    expect(Object.keys(byFile).sort()).toEqual([
      'nx.json#targetDefaults.build[0]',
      'nx.json#targetDefaults.build[1]',
    ]);
    expect(
      byFile['nx.json#targetDefaults.build[0]'].projects['apps/app'].targets
        .build.cache
    ).toBe(true);
    expect(
      byFile['nx.json#targetDefaults.build[1]'].projects['apps/app'].targets
        .build.inputs
    ).toEqual(['vite.config.ts']);
  });
});
