import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { TargetDefaultEntry } from '../../../config/nx-json';

// The legacy record-shape warning fires once per module load. To assert
// on it cleanly we re-load the module in each test via `jest.resetModules`
// so the "warned once" flag resets without an exported test-only reset
// function. Every test reaches the SUT through these let-bound aliases
// so each `it` block sees a fresh module instance.
let findBestTargetDefault: typeof import('./target-defaults').findBestTargetDefault;
let normalizeTargetDefaults: typeof import('./target-defaults').normalizeTargetDefaults;
let normalizeTargetDefaultsAgainstRootMaps: typeof import('./target-defaults').normalizeTargetDefaultsAgainstRootMaps;
let readTargetDefaultsForTarget: typeof import('./target-defaults').readTargetDefaultsForTarget;

// Silence the legacy record-shape warning everywhere except in the
// dedicated describe that asserts on it. The warning writes to stderr
// directly (so it cannot pollute `--json` stdout), so we stub
// `process.stderr.write` rather than any output helper. Restored per
// test so call history doesn't leak between `it` blocks.
let stderrWriteSpy: jest.SpyInstance;
beforeEach(() => {
  jest.resetModules();
  const mod = require('./target-defaults');
  findBestTargetDefault = mod.findBestTargetDefault;
  normalizeTargetDefaults = mod.normalizeTargetDefaults;
  normalizeTargetDefaultsAgainstRootMaps =
    mod.normalizeTargetDefaultsAgainstRootMaps;
  readTargetDefaultsForTarget = mod.readTargetDefaultsForTarget;
  stderrWriteSpy = jest
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);
});
afterEach(() => {
  stderrWriteSpy.mockRestore();
});

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

describe('findBestTargetDefault', () => {
  it('returns null on empty entries', () => {
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        []
      )
    ).toBeNull();
  });

  it('matches exact target name', () => {
    const entries: TargetDefaultEntry[] = [{ target: 'test', cache: true }];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toEqual({ cache: true });
  });

  it('returns null when no target matches', () => {
    const entries: TargetDefaultEntry[] = [{ target: 'build', cache: true }];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toBeNull();
  });

  it('matches a target glob', () => {
    const entries: TargetDefaultEntry[] = [{ target: 'test:*', cache: true }];
    expect(
      findBestTargetDefault(
        'test:ci',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toEqual({ cache: true });
  });

  it('matches by executor field when entry has no target', () => {
    const entries: TargetDefaultEntry[] = [
      { executor: '@nx/vite:test', inputs: ['x'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        '@nx/vite:test',
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toEqual({ executor: '@nx/vite:test', inputs: ['x'] });
  });

  it('executor-only entry does not inject into a bare target — no `target` locator means no targeting', () => {
    // An executor-only entry like `{ executor: '@nx/vite:test' }` is keyed
    // purely by executor: it applies to existing targets that *already* use
    // that executor. It cannot be used to assign an executor to an
    // executor-less target — that would broadcast the executor to every
    // bare target in the workspace. Compare with the
    // `target+executor → injection` behavior covered later in this file,
    // where the `target` locator narrows the assignment to a specific name.
    const entries: TargetDefaultEntry[] = [
      { executor: '@nx/vite:test', inputs: ['x'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toBeNull();
  });

  it('does not interpret entry.target as an executor anymore', () => {
    // Under the legacy record-shape behavior, a key like '@nx/vite:test'
    // matched by executor. The new array shape requires `executor` to be
    // set explicitly — `target: '@nx/vite:test'` only matches a target
    // literally named that.
    const entries: TargetDefaultEntry[] = [
      { target: '@nx/vite:test', inputs: ['x'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        '@nx/vite:test',
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toBeNull();
  });

  it('target+source beats target only', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', cache: true },
      { target: 'test', plugin: '@nx/vite', inputs: ['vite'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        'web',
        node('web'),
        '@nx/vite',
        entries
      )
    ).toEqual({ inputs: ['vite'] });
  });

  it('target+projects beats target+source', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', plugin: '@nx/vite', inputs: ['vite'] },
      { target: 'test', projects: 'web', inputs: ['byproject'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        'web',
        node('web'),
        '@nx/vite',
        entries
      )
    ).toEqual({ inputs: ['byproject'] });
  });

  it('target+projects+source beats all', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', cache: true },
      { target: 'test', plugin: '@nx/vite', inputs: ['vite'] },
      { target: 'test', projects: 'web', inputs: ['byproject'] },
      {
        target: 'test',
        projects: 'web',
        plugin: '@nx/vite',
        inputs: ['both'],
      },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        'web',
        node('web'),
        '@nx/vite',
        entries
      )
    ).toEqual({ inputs: ['both'] });
  });

  it('tie in same tier is broken by later array index', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', inputs: ['first'] },
      { target: 'test', inputs: ['second'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toEqual({ inputs: ['second'] });
  });

  it('exact target match beats glob match in same tier', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test:*', inputs: ['glob'] },
      { target: 'test', inputs: ['exact'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toEqual({ inputs: ['exact'] });
  });

  it('matches by project tag pattern', () => {
    const entries: TargetDefaultEntry[] = [
      {
        target: 'test',
        projects: 'tag:dotnet',
        options: { configuration: 'Release' },
      },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        'api',
        node('api', { tags: ['dotnet'] }),
        undefined,
        entries
      )
    ).toEqual({ options: { configuration: 'Release' } });
  });

  it('does not match when project tag is missing', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', projects: 'tag:dotnet', options: { a: 1 } },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        'web',
        node('web', { tags: ['node'] }),
        undefined,
        entries
      )
    ).toBeNull();
  });

  it('supports array projects with glob + negation', () => {
    const entries: TargetDefaultEntry[] = [
      {
        target: 'test',
        projects: ['apps/*', '!apps/legacy'],
        inputs: ['ok'],
      },
    ];
    const include = findBestTargetDefault(
      'test',
      undefined,
      'apps/web',
      node('apps/web', { root: 'apps/web' }),
      undefined,
      entries
    );
    const exclude = findBestTargetDefault(
      'test',
      undefined,
      'apps/legacy',
      node('apps/legacy', { root: 'apps/legacy' }),
      undefined,
      entries
    );
    expect(include).toEqual({ inputs: ['ok'] });
    expect(exclude).toBeNull();
  });

  it('skips entries requiring source when sourcePlugin is unknown', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', plugin: '@nx/vite', inputs: ['vite'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        'web',
        node('web'),
        undefined,
        entries
      )
    ).toBeNull();
  });

  it('skips entries requiring projects when no projectNode is provided', () => {
    const entries: TargetDefaultEntry[] = [
      { target: 'test', projects: 'web', inputs: ['x'] },
    ];
    expect(
      findBestTargetDefault(
        'test',
        undefined,
        undefined,
        undefined,
        undefined,
        entries
      )
    ).toBeNull();
  });

  // Filter-only entries (no `target`/`executor` locator, only `projects`
  // and/or `source`) intentionally rank below every locator-bearing
  // match at the same tier. The motivating case is a bare
  // `{ plugin: '@nx/jest/plugin', cache: false }` — "for everything the
  // jest plugin contributes, turn caching off" — which previously was
  // silently rejected because the matcher required a locator.
  describe('filter-only entries', () => {
    it('matches a target by `source` alone with no other locator', () => {
      const entries: TargetDefaultEntry[] = [
        { plugin: '@nx/jest/plugin', cache: false },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/jest/plugin',
          entries
        )
      ).toEqual({ cache: false });
    });

    it('skips a `source`-only entry when the source plugin does not match', () => {
      const entries: TargetDefaultEntry[] = [
        { plugin: '@nx/jest/plugin', cache: false },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/vite/plugin',
          entries
        )
      ).toBeNull();
    });

    it('matches a target by `projects` alone with no other locator', () => {
      const entries: TargetDefaultEntry[] = [
        { projects: 'web', inputs: ['only-web'] },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          undefined,
          entries
        )
      ).toEqual({ inputs: ['only-web'] });
    });

    it('an empty entry (no locator and no filter) never matches', () => {
      // The matcher rejects entries with no constraints whatsoever — they
      // would broadcast to every (root, target) pair in the workspace.
      const entries: TargetDefaultEntry[] = [{ cache: false }];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/jest/plugin',
          entries
        )
      ).toBeNull();
    });

    it('a target-name match beats a source-only match at the same tier', () => {
      // `target` alone is tier 1, `source` alone is tier 1. Tie broken by
      // matchKind: exactTarget (rank 2) > filterOnly (rank 0).
      const entries: TargetDefaultEntry[] = [
        { plugin: '@nx/jest/plugin', cache: false },
        { target: 'test', cache: true },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/jest/plugin',
          entries
        )
      ).toEqual({ cache: true });
    });

    it('a target+source entry beats a projects+source entry at the same tier', () => {
      // Both are tier 2 (one locator + one filter vs two filters). Tie
      // broken by matchKind: exactTarget > filterOnly. The locator-bearing
      // entry wins regardless of array order.
      const entries: TargetDefaultEntry[] = [
        {
          target: 'test',
          plugin: '@nx/jest/plugin',
          inputs: ['target+source'],
        },
        {
          projects: 'web',
          plugin: '@nx/jest/plugin',
          inputs: ['filters-only'],
        },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/jest/plugin',
          entries
        )
      ).toEqual({ inputs: ['target+source'] });
    });

    it('among two filter-only entries at the same tier, later index wins', () => {
      const entries: TargetDefaultEntry[] = [
        { plugin: '@nx/jest/plugin', inputs: ['first'] },
        { plugin: '@nx/jest/plugin', inputs: ['second'] },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/jest/plugin',
          entries
        )
      ).toEqual({ inputs: ['second'] });
    });

    it('an empty `projects: []` filter never matches (treated as never-match, not silent broadcast)', () => {
      // `[]` would otherwise sit in `findMatchingProjects` as "match no
      // projects" — silently dropping the entire entry. We surface that
      // intent as an explicit never-match so the entry is skipped in
      // matching but its presence is still validated by the schema.
      const entries: TargetDefaultEntry[] = [
        { target: 'test', projects: [], cache: false },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          undefined,
          entries
        )
      ).toBeNull();
    });

    it('a wildcard-only `projects: "*"` is equivalent to no filter and rejected when there is no other locator', () => {
      // `'*'` matches everything, so a `{ projects: '*' }` entry would
      // broadcast just like an entry with no constraints. The broadcast
      // guard treats wildcard-only `projects` as "no filter".
      const entries: TargetDefaultEntry[] = [
        { projects: '*', cache: false },
        { projects: ['*'], inputs: ['noop-filter'] },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          undefined,
          entries
        )
      ).toBeNull();
    });

    it('a wildcard `projects: "*"` does not bump the specificity tier', () => {
      // `target` alone is tier 1; `target + projects:'*'` should also be
      // tier 1 (wildcard is "no filter"), so a later wildcard entry wins
      // on array index, not on tier.
      const entries: TargetDefaultEntry[] = [
        { target: 'test', cache: true },
        { target: 'test', projects: '*', cache: false },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          undefined,
          entries
        )
      ).toEqual({ cache: false });
    });

    it('projects+source (filter-only, tier 2) beats source alone (filter-only, tier 1)', () => {
      const entries: TargetDefaultEntry[] = [
        { plugin: '@nx/jest/plugin', inputs: ['source-only'] },
        {
          projects: 'web',
          plugin: '@nx/jest/plugin',
          inputs: ['both-filters'],
        },
      ];
      expect(
        findBestTargetDefault(
          'test',
          undefined,
          'web',
          node('web'),
          '@nx/jest/plugin',
          entries
        )
      ).toEqual({ inputs: ['both-filters'] });
    });
  });

  describe('executor field', () => {
    it('matches when entry executor equals target executor (target+executor)', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', inputs: ['target-only'] },
        { target: 'build', executor: '@nx/js:tsc', inputs: ['executor-match'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          '@nx/js:tsc',
          undefined,
          undefined,
          undefined,
          entries
        )
      ).toEqual({ executor: '@nx/js:tsc', inputs: ['executor-match'] });
    });

    it('matches as injection (no tier bump) when target has no executor and no command', () => {
      // Injection-on-match: the entry has both a `target` locator AND an
      // `executor` payload. The `target` narrows the match to one specific
      // name, so it's safe to inject the executor into a bare target with
      // that name. (Contrast with the executor-only entry test earlier in
      // this file, which intentionally returns null — without a `target`
      // locator there's no way to scope the injection.)
      const entries: TargetDefaultEntry[] = [
        { target: 'build', executor: '@nx/js:tsc', inputs: ['inject'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          undefined,
          undefined,
          undefined,
          undefined,
          entries,
          undefined
        )
      ).toEqual({ executor: '@nx/js:tsc', inputs: ['inject'] });
    });

    it('ties injection match with pure target-only; later index wins', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', inputs: ['plain'] },
        { target: 'build', executor: '@nx/js:tsc', inputs: ['inject'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          undefined,
          undefined,
          undefined,
          undefined,
          entries,
          undefined
        )
      ).toEqual({ executor: '@nx/js:tsc', inputs: ['inject'] });
    });

    it('skips entry when target has a different executor', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', executor: '@nx/js:tsc', inputs: ['x'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          '@nx/esbuild:esbuild',
          undefined,
          undefined,
          undefined,
          entries
        )
      ).toBeNull();
    });

    it('skips entry when target has a command but no matching executor', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', executor: '@nx/js:tsc', inputs: ['x'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          undefined,
          undefined,
          undefined,
          undefined,
          entries,
          'some command'
        )
      ).toBeNull();
    });

    it('executor filter match beats target-only entry in tier', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', inputs: ['plain'] },
        { target: 'build', executor: '@nx/js:tsc', inputs: ['filter'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          '@nx/js:tsc',
          undefined,
          undefined,
          undefined,
          entries
        )
      ).toEqual({ executor: '@nx/js:tsc', inputs: ['filter'] });
    });

    it('target+source still beats target+executor-match', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', executor: '@nx/js:tsc', inputs: ['executor-match'] },
        { target: 'build', plugin: '@nx/js', inputs: ['source-match'] },
      ];
      expect(
        findBestTargetDefault(
          'build',
          '@nx/js:tsc',
          'lib',
          node('lib'),
          '@nx/js',
          entries
        )
      ).toEqual({ inputs: ['source-match'] });
    });
  });

  // The predicate path is what synthesis uses to fall back to a less-
  // specific compatible default when the most-specific match would be
  // incompatible with the project's actual target.
  describe('predicate (compatible-fallback) path', () => {
    it('returns the highest-ranked candidate when the predicate accepts it', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', cache: true, inputs: ['generic'] },
        {
          target: 'build',
          executor: '@nx/jest:jest',
          inputs: ['jest-specific'],
        },
      ];
      // Predicate accepts the highest-ranked candidate; iteration
      // returns it immediately.
      expect(
        findBestTargetDefault(
          'build',
          '@nx/jest:jest',
          undefined,
          undefined,
          undefined,
          entries,
          undefined,
          () => true
        )
      ).toEqual({ executor: '@nx/jest:jest', inputs: ['jest-specific'] });
    });

    it('falls through ranked candidates and returns the first compatible one', () => {
      const entries: TargetDefaultEntry[] = [
        { target: 'build', cache: true, inputs: ['generic'] },
        {
          target: 'build',
          executor: '@nx/jest:jest',
          inputs: ['jest-specific'],
        },
      ];
      // Predicate rejects any candidate carrying executor '@nx/jest:jest'.
      // Best (jest-specific) fails; fall back to generic.
      expect(
        findBestTargetDefault(
          'build',
          '@nx/jest:jest',
          undefined,
          undefined,
          undefined,
          entries,
          undefined,
          (config) => config.executor !== '@nx/jest:jest'
        )
      ).toEqual({ cache: true, inputs: ['generic'] });
    });

    it('returns null when no candidate satisfies the predicate', () => {
      const entries: TargetDefaultEntry[] = [
        {
          target: 'build',
          executor: '@nx/jest:jest',
          inputs: ['jest-specific'],
        },
      ];
      expect(
        findBestTargetDefault(
          'build',
          '@nx/jest:jest',
          undefined,
          undefined,
          undefined,
          entries,
          undefined,
          () => false
        )
      ).toBeNull();
    });
  });
});

describe('normalizeTargetDefaults', () => {
  it('returns [] for undefined', () => {
    expect(normalizeTargetDefaults(undefined)).toEqual([]);
  });

  it('passes array through unchanged', () => {
    const input: TargetDefaultEntry[] = [{ target: 'test', cache: true }];
    expect(normalizeTargetDefaults(input)).toEqual(input);
  });

  it('converts record to array preserving insertion order, splitting executor keys', () => {
    const result = normalizeTargetDefaults({
      build: { cache: true },
      'e2e-ci--*': { cache: false },
      '@nx/vite:test': { inputs: ['x'] },
    });
    expect(result).toEqual([
      { target: 'build', cache: true },
      { target: 'e2e-ci--*', cache: false },
      { executor: '@nx/vite:test', inputs: ['x'] },
    ]);
  });

  describe('legacy record-shape warning', () => {
    it('warns once to stderr when record shape is normalized, mentioning nx repair', () => {
      normalizeTargetDefaults({ build: { cache: true } });
      normalizeTargetDefaults({ test: { cache: true } });
      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      const message = stderrWriteSpy.mock.calls[0][0] as string;
      expect(message).toMatch(/legacy record-shape/i);
      expect(message).toMatch(/nx repair/);
    });

    it('never writes the warning to stdout', () => {
      const stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      normalizeTargetDefaults({ build: { cache: true } });
      expect(stdoutSpy).not.toHaveBeenCalled();
      stdoutSpy.mockRestore();
    });

    it('does not warn for array shape', () => {
      normalizeTargetDefaults([{ target: 'build', cache: true }]);
      expect(stderrWriteSpy).not.toHaveBeenCalled();
    });

    it('does not warn when targetDefaults is undefined', () => {
      normalizeTargetDefaults(undefined);
      expect(stderrWriteSpy).not.toHaveBeenCalled();
    });
  });
});

describe('readTargetDefaultsForTarget (backwards-compat wrapper)', () => {
  it('still reads from the legacy record shape', () => {
    expect(
      readTargetDefaultsForTarget('build', {
        build: { inputs: ['a'] },
      })
    ).toEqual({ inputs: ['a'] });
  });

  it('reads from array shape', () => {
    expect(
      readTargetDefaultsForTarget('build', [{ target: 'build', inputs: ['a'] }])
    ).toEqual({ inputs: ['a'] });
  });

  it('returns null when no defaults apply', () => {
    expect(readTargetDefaultsForTarget('test', [])).toBeNull();
    expect(readTargetDefaultsForTarget('test', undefined)).toBeNull();
  });

  it('record: executor key wins over target key (executorOnly outranks exactTarget at same tier)', () => {
    expect(
      readTargetDefaultsForTarget(
        'build',
        {
          build: { inputs: ['by-target'] },
          '@nx/vite:build': { inputs: ['by-executor'] },
        },
        '@nx/vite:build'
      )
    ).toEqual({ executor: '@nx/vite:build', inputs: ['by-executor'] });
  });

  it('record: later key wins for overlapping globs', () => {
    expect(
      readTargetDefaultsForTarget('e2e-ci--file-foo', {
        'e2e-ci--*': { options: { key: 'short' } },
        'e2e-ci--file-*': { options: { key: 'long' } },
      })
    ).toEqual({ options: { key: 'long' } });
  });
});

describe('normalizeTargetDefaultsAgainstRootMaps', () => {
  it('classifies an ambiguous `:` key as executor when only an executor matches', () => {
    expect(
      normalizeTargetDefaultsAgainstRootMaps(
        { '@nx/vite:test': { cache: true } },
        {
          'apps/a': {
            root: 'apps/a',
            targets: { test: { executor: '@nx/vite:test' } },
          },
        }
      )
    ).toEqual([{ executor: '@nx/vite:test', cache: true }]);
  });

  it('classifies an ambiguous `:` key as target when only a target name matches', () => {
    // `serve:dev` is a legitimate target name with `:` in it. The
    // syntactic heuristic would mis-classify it as an executor; the
    // graph-aware classifier sees it's a target name and emits a
    // `target:` entry.
    expect(
      normalizeTargetDefaultsAgainstRootMaps(
        { 'serve:dev': { cache: true } },
        {
          'apps/a': {
            root: 'apps/a',
            targets: { 'serve:dev': { command: 'echo serve' } },
          },
        }
      )
    ).toEqual([{ target: 'serve:dev', cache: true }]);
  });

  it('emits both target and executor entries when the key matches both', () => {
    // Genuine ambiguity — `webpack-cli:build` happens to be the name of
    // both a target and a registered executor in the workspace. Emit both
    // entries rather than guess; matches the v23 migration's behavior.
    expect(
      normalizeTargetDefaultsAgainstRootMaps(
        { 'webpack-cli:build': { cache: true } },
        {
          'apps/a': {
            root: 'apps/a',
            targets: {
              'webpack-cli:build': { executor: 'webpack-cli:build' },
            },
          },
        }
      )
    ).toEqual([
      { target: 'webpack-cli:build', cache: true },
      { executor: 'webpack-cli:build', cache: true },
    ]);
  });

  it('falls back to syntactic heuristic when the key matches neither', () => {
    expect(
      normalizeTargetDefaultsAgainstRootMaps(
        { '@nx/some-unused-plugin:build': { cache: true } },
        { 'apps/a': { root: 'apps/a', targets: {} } }
      )
    ).toEqual([{ executor: '@nx/some-unused-plugin:build', cache: true }]);
  });

  it('classifies a target-named key as `target:` even when the rootMaps are empty', () => {
    expect(
      normalizeTargetDefaultsAgainstRootMaps({ build: { cache: true } }, {})
    ).toEqual([{ target: 'build', cache: true }]);
  });

  it('passes array shape through unchanged', () => {
    const input: TargetDefaultEntry[] = [
      { target: 'build', cache: true },
      { executor: '@nx/vite:test', inputs: ['x'] },
    ];
    expect(
      normalizeTargetDefaultsAgainstRootMaps(input, {
        'apps/a': { root: 'apps/a', targets: { test: {} } },
      })
    ).toEqual(input);
  });

  it('treats glob keys as targets without consulting rootMaps', () => {
    expect(
      normalizeTargetDefaultsAgainstRootMaps(
        { 'e2e-ci--*': { dependsOn: ['build'] } },
        {}
      )
    ).toEqual([{ target: 'e2e-ci--*', dependsOn: ['build'] }]);
  });
});
