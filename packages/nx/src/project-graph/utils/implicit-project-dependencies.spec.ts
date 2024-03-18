import { ProjectGraphBuilder } from '../project-graph-builder';
import { applyImplicitDependencies } from './implicit-project-dependencies';

jest.mock('fs', () => {
  const memFs = require('memfs').fs;
  return {
    ...memFs,
    existsSync: (p) => (p.endsWith('.node') ? true : memFs.existsSync(p)),
  };
});
jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('implicit project dependencies', () => {
  it(`should add implicit deps`, () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'proj1',
      data: {},
    } as any);
    builder.addNode({
      name: 'proj2',
      data: {},
    } as any);

    applyImplicitDependencies(
      {
        proj1: { root: '', implicitDependencies: ['proj2'] },
      },
      builder
    );

    expect(builder.getUpdatedProjectGraph().dependencies['proj1']).toEqual([
      {
        source: 'proj1',
        target: 'proj2',
        type: 'implicit',
      },
    ]);
  });

  it(`should remove implicit deps`, () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'proj1',
      data: {},
    } as any);
    builder.addNode({
      name: 'proj2',
      data: {},
    } as any);
    builder.addImplicitDependency('proj1', 'proj2');

    applyImplicitDependencies(
      {
        proj1: { root: '', implicitDependencies: ['!proj2'] },
      },
      builder
    );

    expect(builder.getUpdatedProjectGraph().dependencies['proj1']).toEqual([]);
  });
});
