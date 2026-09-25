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
      { kind: 'all-projects' },
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
  const selected = { affected: reasons, dependencies: {} };

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

  it('lists a producer outside the selection in its own section', () => {
    const out = formatAffectedExplanation(
      {
        affected: {
          'app:build': [{ kind: 'dependent-output', producer: 'app:prebuild' }],
        },
        dependencies: {
          'app:prebuild': [{ kind: 'input-file', file: 'libs/app/src/x.ts' }],
        },
      },
      'Affected tasks'
    );
    expect(out).toContain(
      'Not selected, but carried the change to a selected task (1):'
    );
    expect(out.indexOf('app:build')).toBeLessThan(out.indexOf('app:prebuild'));
    expect(out).toContain('1 affected task.');
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
    const { affected, dependencies } = explainSelection(
      reasons,
      (name) => name === 'a:build'
    );
    expect(Object.keys(affected)).toEqual(['a:build']);
    expect(Object.keys(dependencies).sort()).toEqual(['b:gen', 'c:gen']);
  });

  it('survives a cycle between dropped entries', () => {
    const { dependencies } = explainSelection(
      {
        ...reasons,
        'c:gen': [{ kind: 'dependent-output', producer: 'b:gen' }],
      },
      (name) => name === 'a:build'
    );
    expect(Object.keys(dependencies).sort()).toEqual(['b:gen', 'c:gen']);
  });
});
