import { describe, expect, it, vi } from 'vitest';
import {
  explainSelection,
  formatAffectedExplanation,
  formatAffectedReason,
  isExplaining,
  type AffectedReason,
} from './affected-reasons';
import { getTouchedProjectsFromLockFile } from '../../plugins/js/project-graph/affected/lock-file-changes';
import { getTouchedProjectsFromTsConfig } from '../../plugins/js/project-graph/affected/tsconfig-json-changes';
import { WholeFileChange } from '../file-utils';
import { jsonDiff } from '../../utils/json-diff';
import * as tsUtils from '../../plugins/js/utils/typescript';
import type { ProjectGraph } from '../../config/project-graph';

/**
 * The reason data the JS locators produce, which their own specs unwrap to bare
 * project names. Without this the payload is unasserted anywhere, which is how
 * a dropped `package` field reached a release candidate once already.
 */
describe('JS locator reasons', () => {
  const nodes = {
    app: { name: 'app', type: 'app', data: { root: 'apps/app' } },
  } as any;
  const graph: ProjectGraph = {
    nodes,
    dependencies: {},
    externalNodes: {},
  } as any;

  it('names the lockfile that changed', () => {
    const touched = getTouchedProjectsFromLockFile(
      [
        {
          file: 'package-lock.json',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      nodes,
      {} as any,
      undefined,
      graph
    ) as AffectedReason[];

    expect(touched.length).toBeGreaterThan(0);
    expect(touched[0]).toMatchObject({
      kind: 'lockfile',
      file: 'package-lock.json',
    });
  });

  // The locator setting `package`, and napi keeping it, are covered in
  // npm-packages.spec and affected-project-graph.spec.
  it('renders an npm-package reason with and without a package name', () => {
    const reason: AffectedReason = {
      kind: 'npm-package',
      package: 'npm:lodash@4.17.21',
    };
    expect(formatAffectedReason(reason)).toBe(
      'depends on npm:lodash@4.17.21, whose version changed'
    );
    // The blanket fallback carries no package name; it must still read as a
    // sentence. An earlier version of this test asserted the opposite and so
    // pinned "depends on undefined, whose version changed" in place.
    const noPackage = formatAffectedReason({
      kind: 'npm-package',
      file: 'package.json',
    });
    expect(noPackage).not.toContain('undefined');
    expect(noPackage).toContain('package.json');
  });

  describe('root tsconfig', () => {
    const touchedBy = (before: object, after: object) => {
      vi.spyOn(tsUtils, 'getRootTsConfigFileName').mockReturnValue(
        'tsconfig.base.json'
      );
      return getTouchedProjectsFromTsConfig(
        [
          {
            file: 'tsconfig.base.json',
            getChanges: () => jsonDiff(before, after),
          },
        ] as any,
        nodes,
        {} as any,
        undefined,
        graph
      );
    };

    // Any change that is not a path mapping touches every project, and must
    // not claim a path mapping moved.
    it('does not blame path mappings for any other option', () => {
      expect(
        touchedBy(
          { compilerOptions: { strict: false } },
          { compilerOptions: { strict: true } }
        )
      ).toEqual([
        { project: 'app', kind: 'tsconfig', file: 'tsconfig.base.json' },
      ]);
    });

    it('names a path mapping into the project', () => {
      expect(
        touchedBy(
          { compilerOptions: { paths: {} } },
          {
            compilerOptions: {
              paths: { '@proj/app': ['apps/app/src/index.ts'] },
            },
          }
        )
      ).toEqual([
        { project: 'app', kind: 'tsconfig-paths', file: 'tsconfig.base.json' },
      ]);
    });
  });

  it('reports nothing when the root tsconfig is untouched', () => {
    const touched = getTouchedProjectsFromTsConfig(
      [
        {
          file: 'apps/app/src/index.ts',
          getChanges: () => [new WholeFileChange()],
        },
      ] as any,
      nodes,
      {} as any,
      undefined,
      graph
    ) as AffectedReason[];
    expect(touched).toEqual([]);
  });
});

describe('formatAffectedReason', () => {
  it('renders every kind without leaking undefined', () => {
    const populated: AffectedReason[] = [
      { kind: 'project-file', file: 'libs/a/src/index.ts' },
      { kind: 'implicit-dependency', file: 'a.txt', pattern: 'a.txt' },
      { kind: 'workspace-configuration', file: 'nx.json' },
      { kind: 'deleted-project-configuration', file: 'libs/a/project.json' },
      { kind: 'project-configuration', file: 'libs/a/project.json' },
      { kind: 'lockfile', file: 'pnpm-lock.yaml' },
      { kind: 'npm-package', package: 'npm:lodash' },
      { kind: 'tsconfig', file: 'tsconfig.base.json' },
      { kind: 'tsconfig-paths', file: 'tsconfig.base.json' },
      { kind: 'custom-hasher' },
      { kind: 'external-dependencies', file: 'pnpm-lock.yaml' },
      { kind: 'dependency', dependency: 'ui' },
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
    expect(out).toContain('Your targets (1):');
    expect(out).toContain('    - affected: reads outputs the change reached');
    expect(out.indexOf('app:prebuild')).toBeLessThan(out.indexOf('app:build'));
    const entries = out.split('\n').filter((line) => /^  \S/.test(line));
    expect(entries.at(-1)).toBe('  app:build');
    expect(out).toContain('1 affected task.');
  });

  it('adds no section labels when nothing was carried', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out).not.toContain('Your targets');
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
    expect(at('Touched,')).toBeLessThan(at('Your targets (2):'));
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
          app: [
            { kind: 'dependency', dependency: 'lib' },
            { kind: 'dependency', dependency: 'cycle' },
          ],
          cycle: [{ kind: 'dependency', dependency: 'app' }],
          lib: files.map((file) => ({ kind: 'project-file' as const, file })),
        },
        upstream: {},
        touched: ['lib'],
      },
      'Affected projects'
    );
    expect(out).toContain('    - traced to a.ts, b.ts, c.ts and 1 more');
  });

  it('sorts an entry reached only through a dependency to the bottom', () => {
    const out = formatAffectedExplanation(selected, 'Affected tasks');
    expect(out.indexOf('ui:build')).toBeLessThan(out.indexOf('app:build'));
  });
});

describe('explainSelection', () => {
  const reasons: Record<string, AffectedReason[]> = {
    'a:build': [{ kind: 'dependent-output', producer: 'b:gen' }],
    'b:gen': [{ kind: 'dependent-output', producer: 'c:gen' }],
    'c:gen': [{ kind: 'input-file', file: 'c/x.ts' }],
    'd:gen': [{ kind: 'input-file', file: 'd/x.ts' }],
  };

  it('follows the chain from the selection through what it drops', () => {
    const { affected, upstream, touched } = explainSelection(
      reasons,
      ['c:gen', 'd:gen'],
      (name) => name === 'a:build'
    );
    expect(Object.keys(affected)).toEqual(['a:build']);
    expect(Object.keys(upstream).sort()).toEqual(['b:gen', 'c:gen']);
    // Only what the output holds: d:gen is touched but outside every chain.
    expect(touched).toEqual(['c:gen']);
  });

  it('survives a cycle between dropped entries', () => {
    const { upstream } = explainSelection(
      {
        ...reasons,
        'c:gen': [{ kind: 'dependent-output', producer: 'b:gen' }],
      },
      [],
      (name) => name === 'a:build'
    );
    expect(Object.keys(upstream).sort()).toEqual(['b:gen', 'c:gen']);
  });
});
