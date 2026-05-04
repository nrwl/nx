import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { TargetDefaultEntry } from '../../../config/nx-json';
import {
  __resetTargetDefaultsLegacyWarning,
  findBestTargetDefault,
  normalizeTargetDefaults,
  readTargetDefaultsForTarget,
} from './target-defaults';

// Silence the legacy record-shape warning everywhere except in the
// dedicated describe that asserts on it. The warning writes to stderr
// directly (so it cannot pollute `--json` stdout), so we stub
// `process.stderr.write` rather than any output helper. Restored per
// test so call history doesn't leak between `it` blocks.
let stderrWriteSpy: jest.SpyInstance;
beforeEach(() => {
  __resetTargetDefaultsLegacyWarning();
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

  it('executor-only entry does not match when target has no executor', () => {
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
      { target: 'test', source: '@nx/vite', inputs: ['vite'] },
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
      { target: 'test', source: '@nx/vite', inputs: ['vite'] },
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
      { target: 'test', source: '@nx/vite', inputs: ['vite'] },
      { target: 'test', projects: 'web', inputs: ['byproject'] },
      {
        target: 'test',
        projects: 'web',
        source: '@nx/vite',
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
      { target: 'test', source: '@nx/vite', inputs: ['vite'] },
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
        { target: 'build', source: '@nx/js', inputs: ['source-match'] },
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
