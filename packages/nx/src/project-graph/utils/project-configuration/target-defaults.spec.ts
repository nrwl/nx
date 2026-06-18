import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import {
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
