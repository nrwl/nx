import { describe, expect, it } from 'vitest';
import {
  formatAffectedReason,
  isExplaining,
  type AffectedReason,
} from './affected-reasons';
import { getTouchedProjectsFromLockFile } from '../../plugins/js/project-graph/affected/lock-file-changes';
import { getTouchedProjectsFromTsConfig } from '../../plugins/js/project-graph/affected/tsconfig-json-changes';
import { WholeFileChange } from '../file-utils';
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

  it('carries the package name on an npm-package reason', () => {
    // The field the napi struct dropped: set here, and it has to survive
    // whatever the value crosses on its way to --explain.
    const reason: AffectedReason = {
      kind: 'npm-package',
      package: 'npm:lodash@4.17.21',
    };
    expect(formatAffectedReason(reason)).toBe(
      'depends on npm:lodash@4.17.21, whose version changed'
    );
    expect(formatAffectedReason({ kind: 'npm-package' })).toContain(
      'undefined'
    );
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
      { kind: 'lockfile', file: 'pnpm-lock.yaml' },
      { kind: 'npm-package', package: 'npm:lodash' },
      { kind: 'tsconfig', file: 'tsconfig.base.json' },
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
