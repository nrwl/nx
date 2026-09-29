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

  // A trace: however long the chain above grows, the reader's own task stays
  // right above the summary.
  it('lists the chain first and the selection last', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': [{ kind: 'dependent-output', producer: 'app:prebuild' }],
        },
        upstream: {
          'app:prebuild': [{ kind: 'input-file', file: 'libs/app/src/x.ts' }],
        },
        touched: ['app:prebuild'],
      },
      'Affected tasks'
    );
    expect(out).toContain('Touched, their own inputs changed (1):');
    expect(out).toMatch(/\n\nAffected tasks \(1\):\n/);
    expect(out).toContain('  app:build\n    - affected through app:prebuild\n');
    // The first line names the producer, so the reason line would repeat it.
    expect(out).not.toContain('reads the outputs of app:prebuild');
    expect(out.indexOf('app:prebuild')).toBeLessThan(out.indexOf('app:build'));
    const entries = out.split('\n').filter((line) => /^  \S/.test(line));
    expect(entries.at(-1)).toBe('  app:build');
    expect(out).toContain('1 affected task.');
  });

  it('adds no section labels when nothing was carried', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out.match(/Affected tasks \(/g)).toHaveLength(1);
    expect(out).not.toContain('Touched,');
  });

  // Run order: what is only needed first, then what the change touched, then
  // what it reached through those, then the reader's own targets.
  it('lays the chain out in layers, the selection last', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': [{ kind: 'dependent-output', producer: 'app:gen' }],
          'lib:build': [{ kind: 'input-file', file: 'libs/lib/x.ts' }],
        },
        upstream: {
          'app:gen': [{ kind: 'input-file', file: 'apps/app/schema.json' }],
        },
        touched: ['app:gen', 'lib:build'],
      },
      'Affected tasks',
      { verbose: true }
    );
    const at = (text: string) => out.indexOf(text);
    expect(at('Touched,')).toBeLessThan(at('\n\nAffected tasks (2):'));
    // Touched targets before the ones reached through them.
    expect(at('  lib:build')).toBeLessThan(at('  app:build'));
    expect(out).toContain('    - touched by libs/lib/x.ts');
    expect(out).toContain('2 affected tasks.');
  });

  // The first line of a touched target names what changed, so the reader
  // need not scan its reasons for it.
  it('names what touched a target, or says so when nothing is named', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'a:e2e': [
            {
              kind: 'moved-ecosystem',
              ecosystem: 'npm',
              file: 'pnpm-lock.yaml',
            },
            { kind: 'external-dependencies', file: 'package.json' },
          ],
          'b:e2e': [{ kind: 'custom-hasher' }],
        },
        upstream: { 'a:gen': [{ kind: 'input-file', file: 'x.ts' }] },
        touched: ['a:e2e', 'a:gen', 'b:e2e'],
      },
      'Affected tasks'
    );
    expect(out).toContain(
      '  a:e2e\n    - touched by package.json and pnpm-lock.yaml'
    );
    expect(out).toContain('  b:e2e\n    - touched: its own inputs changed');
  });

  // The reader's task sits at the bottom, so it names the file its chain
  // starts from rather than making them follow the chain up the output.
  it('traces a chain-only entry back to the changed file', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'docs:build': [{ kind: 'dependent-output', producer: 'docs:gen' }],
        },
        upstream: {
          'docs:gen': [{ kind: 'dependent-output', producer: 'lib:build' }],
          'lib:build': [{ kind: 'input-file', file: 'libs/lib/src/x.ts' }],
        },
        touched: ['lib:build'],
      },
      'Affected tasks'
    );
    const docs = out.slice(out.indexOf('  docs:build'));
    expect(docs).toContain('    - traced to libs/lib/src/x.ts');
    // An entry that names its file already needs no trace.
    expect(out.match(/traced to/g)).toHaveLength(2);
  });

  it('ends a trace on a cycle and counts past the first', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': [
            { kind: 'dependent-output', producer: 'lib:build' },
            { kind: 'dependent-output', producer: 'app:gen' },
          ],
          'app:gen': [{ kind: 'dependent-output', producer: 'app:build' }],
          'lib:build': files.map((file) => ({
            kind: 'input-file' as const,
            file,
          })),
        },
        upstream: {},
        touched: ['lib:build'],
      },
      'Affected tasks'
    );
    expect(out).toContain('    - traced to a.ts and 3 others');
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

  it('summarizes a long set of targets the same way', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => `${p}:e2e`);
    const out = formatAffectedExplanation(
      {
        affected: Object.fromEntries(
          names.map((name) => [
            name,
            [{ kind: 'external-dependencies' as const, file: 'package.json' }],
          ])
        ),
        upstream: {},
        touched: names,
      },
      'Affected tasks'
    );
    expect(out).toContain(
      'Affected tasks (6). Pass --verbose to list each with its reasons.\n\n  Changing package.json touched 6 tasks:\n    - a:e2e\n'
    );
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

  it('lists every reason under verbose', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': ['web:build', 'web:build-base'].map((producer) => ({
            kind: 'dependent-output' as const,
            producer,
          })),
        },
        upstream: {},
        touched: [],
      },
      'Affected tasks',
      { verbose: true }
    );
    expect(out).toContain(
      '    - reads the outputs of web:build-base, which the change reached'
    );
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
      'Touched, their own inputs changed (6). Pass --verbose to list each with its reasons.\n\n  Changing pnpm-lock.yaml touched 6 tasks:\n    - a:build\n    - b:build\n    - c:build\n    - d:build\n    - e:build\n    - and 1 more\n'
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

  it('sorts an entry reached only through a dependency to the bottom', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out.indexOf('ui:build')).toBeLessThan(out.indexOf('app:build'));
  });
});
