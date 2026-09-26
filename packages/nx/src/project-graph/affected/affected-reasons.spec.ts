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

  /**
   * Only the command that is about to run the closure reports it. `nx affected`
   * does; `nx show projects` answers a question and runs nothing, so a count of
   * what it would drag in would describe a run that is not happening.
   */
  it('names the closure when the caller is going to run it', () => {
    expect(
      formatAffectedExplanation(selected, 'Affected tasks', 149)
    ).toContain('2 affected tasks and 149 tasks they depend on.');
  });

  it('reports the selection alone when no closure is passed', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out).toContain('2 affected tasks.');
    expect(out).not.toContain('depend on');
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
    expect(out).toContain('    - affected: reads outputs the change reached');
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
  it('lays the run out in layers, each dependency with what needs it', () => {
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
        required: {
          'core:build': ['a:build', 'b:build', 'c:build'],
          'tools:build': ['app:build'],
        },
      },
      'Affected tasks',
      4
    );
    const at = (text: string) => out.indexOf(text);
    expect(out).toContain('Dependencies, needed to run first (2):');
    expect(out).toContain(
      '  core:build, needed by a:build, b:build and 1 more'
    );
    expect(out).toContain('  tools:build, needed by app:build');
    expect(at('Dependencies,')).toBeLessThan(at('Touched,'));
    expect(at('Touched,')).toBeLessThan(at('\n\nAffected tasks (2):'));
    // Touched targets before the ones reached through them.
    expect(at('  lib:build')).toBeLessThan(at('  app:build'));
    expect(out).toContain('    - touched: its own inputs changed');
    expect(out).toContain('2 affected tasks and 4 tasks they depend on.');
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

  it('ends a trace on a cycle and caps a long list', () => {
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
    expect(out).toContain('    - traced to a.ts, b.ts, c.ts and 1 more');
  });

  it('sorts an entry reached only through a dependency to the bottom', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out.indexOf('ui:build')).toBeLessThan(out.indexOf('app:build'));
  });
});
