import { describe, expect, it } from 'vitest';
import {
  formatAffectedExplanation,
  formatAffectedReason,
  isExplaining,
  type AffectedReason,
} from './affected-reasons';

describe('formatAffectedReason', () => {
  it('renders every kind without leaking undefined', () => {
    const populated: AffectedReason[] = [
      { kind: 'deleted-project-configuration', file: 'libs/a/project.json' },
      { kind: 'project-configuration', file: 'libs/a/project.json' },
      { kind: 'lockfile', file: 'pnpm-lock.yaml' },
      { kind: 'npm-package', package: 'npm:lodash' },
      { kind: 'custom-hasher' },
      { kind: 'moved-ecosystem', ecosystem: 'npm', file: 'pnpm-lock.yaml' },
      { kind: 'moved-ecosystem', ecosystem: 'npm' },
      { kind: 'external-dependencies', file: 'pnpm-lock.yaml' },
      { kind: 'input-file', file: 'libs/a/x.ts', pattern: '{projectRoot}/**' },
      { kind: 'dependent-output', producer: 'ui:build' },
    ];
    for (const reason of populated) {
      const line = formatAffectedReason(reason);
      expect(line).not.toContain('undefined');
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('falls back when an input match names no pattern', () => {
    expect(
      formatAffectedReason({ kind: 'input-file', file: 'tsconfig.json' })
    ).toBe('input matched tsconfig.json');
  });
});

describe('isExplaining', () => {
  it.each([
    [undefined, false],
    [false, false],
    [true, true],
    ['', true],
    ['stdout', true],
    ['reasons.json', true],
  ])('%s -> %s', (value, expected) => {
    expect(isExplaining(value as any)).toBe(expected);
  });
});

describe('formatAffectedExplanation', () => {
  const reasons: Record<string, AffectedReason[]> = {
    'app:build': [{ kind: 'dependent-output', producer: 'ui:build' }],
    'ui:build': [{ kind: 'input-file', file: 'libs/ui/src/x.ts' }],
  };
  const selected = { affected: reasons, upstream: {}, touched: ['ui:build'] };

  // Out of the requested targets' tasks, so it says what selection saved.
  // Grouped by what changed, touched before affected, each task with the
  // reasons the group heading does not already give.
  it('groups a small output by what changed', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'ui:build': [
            {
              kind: 'input-file',
              file: 'libs/ui/src/index.ts',
              pattern: 'libs/ui/**/*',
            },
          ],
          'app:build': [{ kind: 'dependent-output', producer: 'ui:build' }],
          'admin:build': [{ kind: 'dependent-output', producer: 'ui:build' }],
        },
        upstream: {},
        touched: ['ui:build'],
      },
      'Affected tasks'
    );
    expect(out).toBe(
      [
        'Affected tasks (3):',
        '',
        '  Changing libs/ui/src/index.ts touched 1 task:',
        '    ui:build',
        '      - input libs/ui/**/* matched libs/ui/src/index.ts',
        '',
        '  Changing libs/ui/src/index.ts affected 2 tasks through the outputs they read:',
        '    admin:build',
        '      - reads the outputs of ui:build, which the change reached',
        '    app:build',
        '      - reads the outputs of ui:build, which the change reached',
        '',
        '3 affected tasks.',
      ].join('\n')
    );
  });

  it('puts the layers above the targets first, each titled', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': [{ kind: 'dependent-output', producer: 'app:gen' }],
        },
        upstream: {
          'app:gen': [{ kind: 'input-file', file: 'apps/app/schema.json' }],
        },
        touched: ['app:gen'],
      },
      'Affected tasks'
    );
    const at = (text: string) => out.indexOf(text);
    expect(out).toContain(
      'Changing 1 file touched 1 task (tasks with 1 or more direct inputs changed):'
    );
    expect(at('    app:gen')).toBeLessThan(at('\nAffected tasks (1):'));
    expect(out).toContain(
      'Affected tasks (1):\n\n  Changing apps/app/schema.json affected 1 task through the outputs they read:\n    app:build\n'
    );
  });

  // A group heading walks the chain to the changed files, ending on a cycle.
  it('names the changed files a chain starts from', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': [
            { kind: 'dependent-output', producer: 'lib:build' },
            { kind: 'dependent-output', producer: 'app:gen' },
          ],
          'app:gen': [{ kind: 'dependent-output', producer: 'app:build' }],
          'lib:build': ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map((file) => ({
            kind: 'input-file' as const,
            file,
          })),
        },
        upstream: {},
        touched: ['lib:build'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '  Changing a.ts and 3 others affected 2 tasks through the outputs they read:'
    );
  });

  it('names up to five tasks of a long section, or all under verbose', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => `${p}:e2e`);
    const explanation = {
      affected: Object.fromEntries(
        names.map((name) => [
          name,
          [{ kind: 'external-dependencies' as const, file: 'package.json' }],
        ])
      ),
      upstream: {},
      touched: names,
    };
    expect(formatAffectedExplanation(explanation, 'Affected tasks')).toContain(
      'Pass --verbose to list each with its reasons.\n\n  Changing package.json touched 6 tasks:\n    - a:e2e\n    - b:e2e\n    - c:e2e\n    - d:e2e\n    - e:e2e\n    - and 1 more\n'
    );
    const verbose = formatAffectedExplanation(explanation, 'Affected tasks', {
      verbose: true,
    });
    expect(verbose).toContain(
      '  Changing package.json touched 6 tasks:\n    a:e2e\n      - hashes every external dependency, and package.json changed\n'
    );
    expect(verbose).toContain('    f:e2e\n');
    expect(verbose).not.toContain('Pass --verbose');
  });

  it('says so when a touched task names no changed file', () => {
    const out = formatAffectedExplanation(
      {
        affected: { 'b:e2e': [{ kind: 'custom-hasher' }] },
        upstream: {},
        touched: ['b:e2e'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '  1 task was touched without a changed file to name:\n    b:e2e\n      - its executor uses a custom hasher, so it is always selected'
    );
  });

  it('counts what was affected out of the requested tasks', () => {
    const out = formatAffectedExplanation(
      { ...selected, requested: { targets: ['build', 'test'], total: 58 } },
      'Affected tasks'
    );
    expect(out).toContain('2 out of 58 build, test tasks were affected.');
  });

  it('agrees in number with a single task', () => {
    const out = formatAffectedExplanation(
      {
        affected: { 'ui:build': reasons['ui:build'] },
        upstream: {},
        touched: ['ui:build'],
        requested: { targets: ['build'], total: 1 },
      },
      'Affected tasks'
    );
    expect(out).toContain('1 out of 1 build task was affected.');
  });

  it('reports the selection alone without a requested count', () => {
    expect(formatAffectedExplanation(selected, 'Affected tasks')).toContain(
      '2 affected tasks.'
    );
  });

  it('adds no section labels when nothing was carried', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out.match(/Affected tasks \(/g)).toHaveLength(1);
    expect(out).not.toContain('direct inputs changed');
  });

  // A refactor or a dependency bump would otherwise print a line per file or
  // package under every task.
  it('names the first file or package and counts the rest', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'].map(
      (f) => `libs/ui/${f}`
    );
    const out = formatAffectedExplanation(
      {
        affected: {
          'ui:build': [
            ...files.map((file) => ({
              kind: 'input-file' as const,
              file,
              pattern: 'libs/ui/**/*',
            })),
            { kind: 'input-file', file: 'tsconfig.base.json' },
            ...['npm:a', 'npm:b', 'npm:c', 'npm:d'].map((pkg) => ({
              kind: 'npm-package' as const,
              package: pkg,
            })),
          ],
        },
        upstream: {},
        touched: ['ui:build'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '    - input libs/ui/**/* matched libs/ui/a.ts and 4 other files'
    );
    expect(out).toContain('    - input matched tsconfig.base.json');
    expect(out).toContain(
      '    - depends on npm:a and 3 other packages, whose versions changed'
    );
    expect(out).not.toContain('libs/ui/b.ts');
  });

  it('names the first producer read and counts the rest', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:e2e': [{ kind: 'dependent-output', producer: 'app:build' }],
        },
        upstream: {
          'app:build': ['web:build', 'web:build-base', 'webpack:build'].map(
            (producer) => ({ kind: 'dependent-output' as const, producer })
          ),
        },
        touched: [],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '    - reads the outputs of web:build and 2 other tasks the change reached'
    );
    expect(out).not.toContain('web:build-base');
  });

  it('keeps a single match on its own line, and counts one other', () => {
    const match = (f: string) => ({
      kind: 'input-file' as const,
      file: `libs/ui/${f}`,
      pattern: 'libs/ui/**/*',
    });
    const explain = (files: string[]) =>
      formatAffectedExplanation(
        {
          affected: { 'ui:build': files.map(match) },
          upstream: {},
          touched: ['ui:build'],
        },
        'Affected tasks'
      );
    expect(explain(['a.ts'])).toContain(
      '    - input libs/ui/**/* matched libs/ui/a.ts\n'
    );
    expect(explain(['a.ts', 'b.ts'])).toContain(
      '    - input libs/ui/**/* matched libs/ui/a.ts and 1 other file'
    );
  });

  // Each entry of a long layer repeats the same few files, so it reads as
  // one line per cause; a short layer stays listed for following a chain.
  it('summarizes a long layer above the targets by cause', () => {
    const lockfile = [
      { kind: 'external-dependencies' as const, file: 'pnpm-lock.yaml' },
    ];
    const upstream = Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => [`${p}:build`, lockfile])
    );
    const explanation = {
      affected: {
        'app:e2e': [{ kind: 'dependent-output' as const, producer: 'a:build' }],
      },
      upstream,
      touched: Object.keys(upstream),
    };
    const out = formatAffectedExplanation(explanation, 'Affected tasks');
    expect(out).toContain(
      'Changing 1 file touched 6 tasks (tasks with 1 or more direct inputs changed). Pass --verbose to list each with its reasons.\n\n  Changing pnpm-lock.yaml touched 6 tasks:\n    - a:build\n    - b:build\n    - c:build\n    - d:build\n    - e:build\n    - and 1 more\n'
    );
    expect(out).not.toContain('  f:build');
    expect(
      formatAffectedExplanation(explanation, 'Affected tasks', {
        verbose: true,
      })
    ).toContain('  f:build');
  });

  // Hashing every external already covers every package that moved, and the
  // same reason for two files is one sentence.
  it('merges a reason repeated per file, and drops what another covers', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:e2e': [
            { kind: 'moved-ecosystem', ecosystem: 'npm', file: 'package.json' },
            {
              kind: 'moved-ecosystem',
              ecosystem: 'npm',
              file: 'pnpm-lock.yaml',
            },
            { kind: 'external-dependencies', file: 'package.json' },
            { kind: 'external-dependencies', file: 'pnpm-lock.yaml' },
          ],
        },
        upstream: {},
        touched: ['app:e2e'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '    - hashes every external dependency, and package.json and pnpm-lock.yaml changed'
    );
    expect(out).not.toContain("couldn't be narrowed");
  });
});
