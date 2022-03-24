import { ProjectGraphProcessorContext } from 'nx/src/shared/project-graph';
import { ProjectGraphBuilder } from '../project-graph-builder';
import { buildImplicitProjectDependencies } from './implicit-project-dependencies';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/app-root', () => ({
  appRootPath: '/root',
}));

describe('explicit project dependencies', () => {
  let ctx: ProjectGraphProcessorContext;

  it(`should add implicit deps`, () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'proj1',
      data: { files: [] },
    } as any);
    builder.addNode({
      name: 'proj2',
      data: { files: [] },
    } as any);

    buildImplicitProjectDependencies(
      {
        filesToProcess: {},
        fileMap: {},
        workspace: {
          projects: {
            proj1: { implicitDependencies: ['proj2'] },
          },
        },
      } as any,
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
      data: { files: [] },
    } as any);
    builder.addNode({
      name: 'proj2',
      data: { files: [] },
    } as any);
    builder.addImplicitDependency('proj1', 'proj2');

    buildImplicitProjectDependencies(
      {
        filesToProcess: {},
        fileMap: {},
        workspace: {
          projects: {
            proj1: { implicitDependencies: ['!proj2'] },
          },
        },
      } as any,
      builder
    );

    expect(builder.getUpdatedProjectGraph().dependencies['proj1']).toEqual([]);
  });
});
