import { describe, expect, it, vi } from 'vitest';

// The walk itself is covered by affected-project-graph.spec; these tests pin
// what the command does with its answer.
vi.mock('../../project-graph/affected/affected-project-graph', () => ({
  filterAffected: vi.fn(),
  filterAffectedWithReasons: async () => ({
    reasons: {
      nx: [{ kind: 'project-file', file: 'packages/nx/src/x.ts' }],
      devkit: [{ kind: 'dependency', dependency: 'nx' }],
      docs: [{ kind: 'dependency', dependency: 'nx' }],
      js: [{ kind: 'dependency', dependency: 'devkit' }],
    },
  }),
}));
vi.mock('../../project-graph/file-utils', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  calculateFileChanges: () => [],
}));

import { explainAffectedProjects } from './affected';

const project = (name: string, targets: string[]) => ({
  name,
  type: 'lib',
  data: {
    root: `packages/${name}`,
    targets: Object.fromEntries(targets.map((t) => [t, {}])),
  },
});

// docs has no build target, and js is only reached through devkit.
const projectGraph = {
  nodes: {
    nx: project('nx', ['build']),
    devkit: project('devkit', ['build']),
    docs: project('docs', ['serve']),
    js: project('js', ['build']),
  },
  dependencies: {},
  externalNodes: {},
} as any;

const explain = (nxArgs: object) =>
  explainAffectedProjects(
    { targets: ['build'], files: ['packages/nx/src/x.ts'], ...nxArgs } as any,
    projectGraph,
    {} as any
  );

describe('explainAffectedProjects', () => {
  it('explains only the projects the run acts on', async () => {
    const { affected, dependencies } = await explain({});
    expect(Object.keys(affected).sort()).toEqual(['devkit', 'js', 'nx']);
    expect(dependencies).toEqual({});
  });

  // An excluded project still carried the change, so its dependents' reasons
  // name it and it has to be found somewhere in the output.
  it('moves an excluded project a reason names to the dependencies', async () => {
    const { affected, dependencies } = await explain({ exclude: ['nx'] });
    expect(Object.keys(affected).sort()).toEqual(['devkit', 'js']);
    expect(Object.keys(dependencies)).toEqual(['nx']);
  });

  it('drops an excluded project nothing selected depends on', async () => {
    const { affected, dependencies } = await explain({ exclude: ['js'] });
    expect(Object.keys(affected).sort()).toEqual(['devkit', 'nx']);
    expect(dependencies).toEqual({});
  });
});
