import { ProjectGraphProcessorContext } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph-builder';
import { buildImplicitProjectDependencies } from './implicit-project-dependencies';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('explicit project dependencies', () => {
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

    buildImplicitProjectDependencies(
      {
        filesToProcess: {},
        fileMap: {},
        projectsConfigurations: {
          version: 2,
          projects: {
            proj1: { root: '', implicitDependencies: ['proj2'] },
          },
        },
      } as Partial<ProjectGraphProcessorContext> as ProjectGraphProcessorContext,
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

    buildImplicitProjectDependencies(
      {
        filesToProcess: {},
        fileMap: {},
        projectsConfigurations: {
          version: 2,
          projects: {
            proj1: { root: '', implicitDependencies: ['!proj2'] },
          },
        },
      } as Partial<ProjectGraphProcessorContext> as ProjectGraphProcessorContext,
      builder
    );

    expect(builder.getUpdatedProjectGraph().dependencies['proj1']).toEqual([]);
  });
});
