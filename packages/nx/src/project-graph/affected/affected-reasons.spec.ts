import { describe, expect, it } from 'vitest';
import {
  formatAffectedExplanation,
  formatAffectedReason,
  hydrateExplanation,
  isExplaining,
  type AffectedExplanation,
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

  it('shows a match without a pattern as the file alone', () => {
    expect(
      formatAffectedReason({ kind: 'input-file', file: 'tsconfig.json' })
    ).toBe('tsconfig.json');
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

  // Touched tasks, then the tasks reached through their outputs. The tasks
  // asked for are counted and listed first, not split into their own section.
  it('lays out what was touched, then what read its outputs', () => {
    const explanation: AffectedExplanation = {
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
      requested: { targets: ['build'], total: 12 },
    };
    expect(formatAffectedExplanation(explanation, 'Affected tasks')).toBe(
      [
        '3 out of 12 build tasks are affected:',
        '',
        'Changing 1 file touches 1 build task. Pass --verbose to list each with its reasons.',
        '',
        '  libs/ui/src/index.ts:',
        '    - ui:build',
        '',
        'Touching those tasks changes outputs read by 2 build tasks. Pass --verbose to list each with its reasons.',
        '  - admin:build',
        '  - app:build',
      ].join('\n')
    );
    expect(
      formatAffectedExplanation(explanation, 'Affected tasks', {
        verbose: true,
      })
    ).toBe(
      [
        '3 out of 12 build tasks are affected:',
        '',
        'Changing 1 file touches 1 build task:',
        '',
        '  libs/ui/src/index.ts:',
        '    ui:build',
        '      - libs/ui/src/index.ts (libs/ui/**/*)',
        '',
        'Touching those tasks changes outputs read by 2 build tasks:',
        '  admin:build',
        '    - reads the outputs of ui:build',
        '  app:build',
        '    - reads the outputs of ui:build',
      ].join('\n')
    );
  });

  it('lists a target first among the tasks of its cause', () => {
    const lockfile = [
      { kind: 'external-dependencies' as const, file: 'pnpm-lock.yaml' },
    ];
    const upstream = Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => [`${p}:build`, lockfile])
    );
    const explanation = {
      affected: { 'z:e2e': lockfile },
      upstream,
      touched: [...Object.keys(upstream), 'z:e2e'],
      requested: { targets: ['e2e'], total: 1 },
    };
    const out = formatAffectedExplanation(explanation, 'Affected tasks');
    expect(out).toContain(
      'Changing 1 file touches 1 e2e task and 6 tasks it depends on. Pass --verbose to list each with its reasons.\n\n  pnpm-lock.yaml:\n    - z:e2e\n    - a:build\n    - b:build\n    - c:build\n    - d:build\n    - and 2 more tasks the e2e tasks depend on'
    );
    const verbose = formatAffectedExplanation(explanation, 'Affected tasks', {
      verbose: true,
    });
    expect(verbose).toContain(
      '    z:e2e\n      - hashes every external dependency, and pnpm-lock.yaml changes\n'
    );
    expect(verbose).toContain('    f:build\n');
    expect(verbose).not.toContain('Pass --verbose');
  });

  it('styles each listed task, knowing which were asked for', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:e2e': [{ kind: 'dependent-output', producer: 'app:build' }],
        },
        upstream: { 'app:build': [{ kind: 'input-file', file: 'x.ts' }] },
        touched: ['app:build'],
      },
      'Affected tasks',
      {
        verbose: true,
        styleTask: (id, asked) => (asked ? `**${id}**` : `_${id}_`),
      }
    );
    expect(out).toContain('  **app:e2e**\n');
    expect(out).toContain('  _app:build_\n');
  });

  it('groups touched tasks by file when several changed', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'a:test': [{ kind: 'input-file', file: 'a.ts' }],
          'b:test': [{ kind: 'input-file', file: 'b.ts' }],
        },
        upstream: {},
        touched: ['a:test', 'b:test'],
        requested: { targets: ['test'], total: 2 },
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain(
      'Changing 2 files touches 2 test tasks:\n\n  a.ts:\n    a:test\n'
    );
  });

  it('names the first of several files a task matched', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'a:test': ['a.ts', 'b.ts', 'c.ts'].map((file) => ({
            kind: 'input-file' as const,
            file,
          })),
        },
        upstream: {},
        touched: ['a:test'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      'Changing 3 files touches 1 requested task. Pass --verbose to list each with its reasons.\n\n  a.ts and 2 other files:'
    );
  });

  it('says so when a touched task names no changed file', () => {
    const out = formatAffectedExplanation(
      {
        affected: { 'b:e2e': [{ kind: 'custom-hasher' }] },
        upstream: {},
        touched: ['b:e2e'],
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain(
      '1 requested task is touched with no changed file to name:\n  b:e2e\n    - its executor uses a custom hasher, so it is always selected'
    );
  });

  it('titles what is affected out of the requested tasks', () => {
    const out = formatAffectedExplanation(
      { ...selected, requested: { targets: ['build', 'test'], total: 58 } },
      'Affected tasks'
    );
    expect(out).toMatch(/^2 out of 58 build and test tasks are affected:\n/);
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
    expect(out).toMatch(/^1 out of 1 build task is affected:\n/);
  });

  it('titles the selection alone without a requested count', () => {
    expect(formatAffectedExplanation(selected, 'Affected tasks')).toMatch(
      /^Affected tasks \(2\):\n/
    );
  });

  // A refactor or a dependency bump would otherwise print a line per file or
  // package under every task.
  it('lists each matched file, and the first package with a count', () => {
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
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain(
      ['a', 'b', 'c', 'd', 'e']
        .map((f) => `      - libs/ui/${f}.ts (libs/ui/**/*)\n`)
        .join('')
    );
    expect(out).toContain('      - tsconfig.base.json\n');
    expect(out).toContain(
      '    - depends on npm:a and 3 other packages, whose versions change'
    );
  });

  it('names every producer read', () => {
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
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain(
      '    - reads the outputs of web:build, web:build-base and webpack:build'
    );
  });

  it('gives each matched file its own line', () => {
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
        'Affected tasks',
        { verbose: true }
      );
    expect(explain(['a.ts'])).toMatch(
      /- libs\/ui\/a\.ts \(libs\/ui\/\*\*\/\*\)$/
    );
    expect(explain(['a.ts', 'b.ts'])).toContain(
      '      - libs/ui/a.ts (libs/ui/**/*)\n      - libs/ui/b.ts (libs/ui/**/*)'
    );
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
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toMatch(
      /- hashes every external dependency, and package.json and pnpm-lock.yaml change$/m
    );
    expect(out).not.toContain("can't be narrowed");
  });

  it('names the packages that moved, in a section after the files', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:e2e': [
            { kind: 'input-file', file: 'apps/app/main.ts' },
            { kind: 'external-dependencies', file: 'package.json' },
            { kind: 'external-dependencies', file: 'pnpm-lock.yaml' },
          ],
          'app:build': [
            { kind: 'npm-package', package: 'npm:react', file: 'package.json' },
          ],
        },
        upstream: {},
        touched: ['app:e2e', 'app:build'],
        moved: {
          'package.json': ['npm:react'],
          'pnpm-lock.yaml': ['npm:react', 'npm:scheduler'],
        },
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toBe(
      [
        'Affected tasks (2):',
        '',
        'Changing 1 file touches 1 requested task:',
        '',
        '  apps/app/main.ts:',
        '    app:e2e',
        '      - apps/app/main.ts',
        '      - hashes every external dependency, and npm:react and 1 other package changed version',
        '',
        'Changing 2 packages touches 2 requested tasks:',
        '',
        '  npm:react:',
        '    app:build',
        '      - depends on npm:react, whose version changes',
        '',
        '  npm:react and npm:scheduler:',
        '    app:e2e',
        '      - apps/app/main.ts',
        '      - hashes every external dependency, and npm:react and 1 other package changed version',
      ].join('\n')
    );
    expect(out).not.toContain('pnpm-lock.yaml');
  });

  it('counts the tasks a short list leaves out, yours apart', () => {
    const reason = [{ kind: 'input-file' as const, file: 'a.ts' }];
    const ids = [
      ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((p) => `${p}:e2e`),
      'x:build',
      'y:build',
    ];
    const out = formatAffectedExplanation(
      {
        affected: Object.fromEntries(
          ids.filter((id) => id.endsWith(':e2e')).map((id) => [id, reason])
        ),
        upstream: { 'x:build': reason, 'y:build': reason },
        touched: ids,
        requested: { targets: ['e2e'], total: 7 },
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '    - e:e2e\n    - and 2 more e2e tasks and 2 tasks they depend on'
    );
  });

  it('counts your tasks per target', () => {
    const reason = [{ kind: 'input-file' as const, file: 'a.ts' }];
    const out = formatAffectedExplanation(
      {
        affected: { 'a:test': reason, 'b:test': reason, 'a:e2e-ci': reason },
        upstream: { 'a:build': reason },
        touched: ['a:test', 'b:test', 'a:e2e-ci', 'a:build'],
        requested: { targets: ['e2e-ci', 'test'], total: 10 },
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toMatch(/^3 out of 10 e2e-ci and test tasks are affected:/);
    expect(out).toContain(
      'Changing 1 file touches 1 e2e-ci task, 2 test tasks and 1 task they depend on:'
    );
  });

  // Both sets shorten to "a.ts and 3 other files", but different files touched them.
  it('keeps sets apart that share a shortened heading', () => {
    const touchedBy = (files: string[]) =>
      files.map((file) => ({ kind: 'input-file' as const, file }));
    const out = formatAffectedExplanation(
      {
        affected: {
          'x:test': touchedBy(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
          'y:test': touchedBy(['a.ts', 'e.ts', 'f.ts', 'g.ts']),
        },
        upstream: {},
        touched: ['x:test', 'y:test'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '  b.ts and 3 other files:\n    - x:test\n\n  e.ts and 3 other files:\n    - y:test'
    );
  });

  // Only d.ts sets x apart from y and only c.ts from z, so x names both.
  it('names as many files as it takes to tell each lookalike apart', () => {
    const touchedBy = (files: string[]) =>
      files.map((file) => ({ kind: 'input-file' as const, file }));
    const out = formatAffectedExplanation(
      {
        affected: {
          'x:test': touchedBy(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
          'y:test': touchedBy(['a.ts', 'b.ts', 'c.ts', 'e.ts']),
          'z:test': touchedBy(['a.ts', 'b.ts', 'd.ts', 'f.ts']),
        },
        upstream: {},
        touched: ['x:test', 'y:test', 'z:test'],
      },
      'Affected tasks'
    );
    expect(out).toContain('  c.ts, d.ts and 2 other files:\n    - x:test');
    expect(out).toContain('  e.ts and 3 other files:\n    - y:test');
    expect(out).toContain('  f.ts and 3 other files:\n    - z:test');
  });

  it('names every file of a group under --verbose', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'x:test': ['a.ts', 'b.ts', 'c.ts'].map((file) => ({
            kind: 'input-file' as const,
            file,
          })),
        },
        upstream: {},
        touched: ['x:test'],
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain('  a.ts, b.ts and c.ts:\n    x:test');
  });

  // e.ts leads y's heading, but z's own set already reads "e.ts and 3 other files".
  it('keeps the first name when leading with a telling file would collide', () => {
    const touchedBy = (files: string[]) =>
      files.map((file) => ({ kind: 'input-file' as const, file }));
    const out = formatAffectedExplanation(
      {
        affected: {
          'x:test': touchedBy(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
          'y:test': touchedBy(['a.ts', 'b.ts', 'c.ts', 'e.ts']),
          'z:test': touchedBy(['e.ts', 'f.ts', 'g.ts', 'h.ts']),
        },
        upstream: {},
        touched: ['x:test', 'y:test', 'z:test'],
      },
      'Affected tasks'
    );
    expect(out).toContain('  d.ts and 3 other files:\n    - x:test');
    expect(out).toContain('  a.ts, e.ts and 2 other files:\n    - y:test');
    expect(out).toContain('  e.ts and 3 other files:\n    - z:test');
  });

  it('names every pattern a file matched on its line', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'a:test': ['src/**', '{projectRoot}/**'].map((pattern) => ({
            kind: 'input-file' as const,
            file: 'src/a.ts',
            pattern,
          })),
        },
        upstream: {},
        touched: ['a:test'],
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain('      - src/a.ts (src/**, {projectRoot}/**)');
  });

  it('dims the pattern a file matched, when given a style', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'a:test': [{ kind: 'input-file', file: 'a.ts', pattern: 'src/**' }],
        },
        upstream: {},
        touched: ['a:test'],
      },
      'Affected tasks',
      { verbose: true, dim: (text) => `~${text}~` }
    );
    expect(out).toContain('      - a.ts ~(src/**)~');
  });

  // With none of yours in a section, "they" would name nothing.
  it('names your targets when a section holds only tasks they depend on', () => {
    const reason = [{ kind: 'input-file' as const, file: 'a.ts' }];
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:e2e-ci': [{ kind: 'dependent-output', producer: 'app:build' }],
        },
        upstream: { 'app:build': reason },
        touched: ['app:build'],
        requested: { targets: ['e2e-ci', 'test'], total: 4 },
      },
      'Affected tasks'
    );
    expect(out).toContain(
      'Changing 1 file touches 1 task the e2e-ci and test tasks depend on.'
    );
    expect(out).toContain(
      'Touching those tasks changes outputs read by 1 e2e-ci task.'
    );
  });

  it('emphasizes your targets where a count names them, when given a style', () => {
    const reason = [{ kind: 'input-file' as const, file: 'a.ts' }];
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => `${p}:build`);
    const out = formatAffectedExplanation(
      {
        affected: { 'z:test': reason },
        upstream: Object.fromEntries(ids.map((id) => [id, reason])),
        touched: [...ids, 'z:test'],
        requested: { targets: ['test'], total: 1 },
      },
      'Affected tasks',
      { bold: (text) => `**${text}**` }
    );
    expect(out).toContain('touches 1 **test** task and 6 tasks it depends on');
    expect(out).toContain('- and 2 more tasks the **test** tasks depend on');
  });

  // app:test is touched itself, and also reads ui:build's changed outputs.
  it('lists a touched task again when it also reads changed outputs', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:test': [
            { kind: 'input-file', file: 'apps/app/a.ts' },
            { kind: 'dependent-output', producer: 'ui:build' },
          ],
        },
        upstream: {
          'ui:build': [{ kind: 'input-file', file: 'libs/ui/b.ts' }],
        },
        touched: ['app:test', 'ui:build'],
        requested: { targets: ['test'], total: 1 },
      },
      'Affected tasks'
    );
    expect(out).toContain('  apps/app/a.ts:\n    - app:test');
    expect(out).toContain(
      'Touching those tasks changes outputs read by 1 test task. Pass --verbose to list each with its reasons.\n  - app:test'
    );
  });
});

describe('hydrateExplanation', () => {
  const file = (file: string, pattern?: string): AffectedReason => ({
    kind: 'input-file',
    file,
    pattern,
  });

  it('expands a shared entry under every task that holds it', () => {
    const shared = [file('libs/a/x.ts', 'libs/a/**/*')];
    const hydrated = hydrateExplanation({
      inputs: [shared],
      affected: {
        'a:build': [{ kind: 'inputs', inputs: [0] }],
        'b:build': [
          { kind: 'inputs', inputs: [0] },
          { kind: 'dependent-output', producer: 'a:build' },
        ],
      },
      upstream: {},
      touched: ['a:build', 'b:build'],
    });
    expect(hydrated).toEqual({
      affected: {
        'a:build': shared,
        'b:build': [
          ...shared,
          { kind: 'dependent-output', producer: 'a:build' },
        ],
      },
      upstream: {},
      touched: ['a:build', 'b:build'],
    });
  });

  // Several instructions merge as one task's matches did: kinds in order,
  // each sorted, a reason two instructions share listed once.
  it('merges several entries into one sorted, deduplicated list', () => {
    const hydrated = hydrateExplanation({
      inputs: [
        [
          file('libs/b/y.ts', 'libs/b/**/*'),
          { kind: 'external-dependencies', file: 'package.json' },
        ],
        [
          { kind: 'npm-package', package: 'npm:react', file: 'package.json' },
          file('libs/a/x.ts', 'libs/a/**/*'),
          file('libs/b/y.ts', 'libs/b/**/*'),
          { kind: 'external-dependencies', file: 'package.json' },
        ],
        [{ kind: 'npm-package', package: 'npm:lodash', file: 'package.json' }],
      ],
      affected: { 'a:build': [{ kind: 'inputs', inputs: [0, 1, 2] }] },
      upstream: {},
      touched: ['a:build'],
    });
    expect(hydrated.affected['a:build']).toEqual([
      file('libs/a/x.ts', 'libs/a/**/*'),
      file('libs/b/y.ts', 'libs/b/**/*'),
      { kind: 'npm-package', package: 'npm:lodash', file: 'package.json' },
      { kind: 'npm-package', package: 'npm:react', file: 'package.json' },
      { kind: 'external-dependencies', file: 'package.json' },
    ]);
  });
});
