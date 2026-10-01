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
    ).toBe('tsconfig.json matches an input');
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
        requested: { targets: ['build'], total: 12 },
      },
      'Affected tasks'
    );
    expect(out).toBe(
      [
        '3 out of 12 build tasks are affected:',
        '',
        'Changing 1 file touches 1 build task:',
        '',
        '  libs/ui/src/index.ts:',
        '    ui:build',
        '      - libs/ui/src/index.ts matches libs/ui/**/*',
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
      'Changing 1 file touches 1 e2e task and 6 other tasks. Pass --verbose to list each with its reasons.\n\n  pnpm-lock.yaml:\n    - z:e2e\n    - a:build\n    - b:build\n    - c:build\n    - d:build\n    - and 2 other tasks'
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
      { styleTask: (id, asked) => (asked ? `**${id}**` : `_${id}_`) }
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
      'Affected tasks'
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
      'Changing 3 files touches 1 requested task:\n\n  a.ts and 2 other files:'
    );
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
      '    - libs/ui/a.ts and 4 other files match libs/ui/**/*'
    );
    expect(out).toContain('    - tsconfig.base.json matches an input');
    expect(out).toContain(
      '    - depends on npm:a and 3 other packages, whose versions change'
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
      '    - reads the outputs of web:build and 2 other tasks'
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
    expect(explain(['a.ts'])).toMatch(
      /- libs\/ui\/a\.ts matches libs\/ui\/\*\*\/\*$/
    );
    expect(explain(['a.ts', 'b.ts'])).toContain(
      '    - libs/ui/a.ts and 1 other file match libs/ui/**/*'
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
      'Affected tasks'
    );
    expect(out).toMatch(
      /- hashes every external dependency, and package.json and pnpm-lock.yaml change$/m
    );
    expect(out).not.toContain("couldn't be narrowed");
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
      'Affected tasks'
    );
    expect(out).toBe(
      [
        'Affected tasks (2):',
        '',
        'Changing 1 file touches 1 requested task:',
        '',
        '  apps/app/main.ts:',
        '    app:e2e',
        '      - apps/app/main.ts matches an input',
        '      - hashes every external dependency, including npm:react and 1 other package, which moved',
        '',
        'Changing 2 packages touches 2 requested tasks:',
        '',
        '  npm:react:',
        '    app:build',
        '      - depends on npm:react, whose version changes',
        '',
        '  npm:react and npm:scheduler:',
        '    app:e2e',
        '      - apps/app/main.ts matches an input',
        '      - hashes every external dependency, including npm:react and 1 other package, which moved',
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
      '    - e:e2e\n    - and 2 other e2e tasks and 2 other tasks'
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
      'Affected tasks'
    );
    expect(out).toMatch(/^3 out of 10 e2e-ci and test tasks are affected:/);
    expect(out).toContain(
      'Changing 1 file touches 1 e2e-ci task, 2 test tasks and 1 other task:'
    );
  });
});
