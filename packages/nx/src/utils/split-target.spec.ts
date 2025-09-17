import { ProjectGraph } from '../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { splitTarget } from './split-target';

let projectGraph: ProjectGraph;

describe('splitTarget', () => {
  beforeAll(() => {
    let builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'project',
      data: {
        root: '',
        targets: {
          target: {},
          'target:target': {},
        },
      },
      type: 'app',
    });
    builder.addNode({
      name: ':utils:common',
      data: {
        root: '',
        targets: {
          target: {
            configurations: {
              prod: {},
              dev: {},
            },
          },
        },
      },
      type: 'app',
    });
    builder.addNode({
      name: ':utils:common:target',
      data: {
        root: '',
        targets: {
          prod: {},
        },
      },
      type: 'app',
    });

    projectGraph = builder.getUpdatedProjectGraph();
  });

  it('should support only project', () => {
    expect(splitTarget('project', projectGraph)).toEqual(['project']);
    expect(splitTarget(':utils:common', projectGraph)).toEqual([
      ':utils:common',
    ]);
  });

  it('should split project:target', () => {
    expect(splitTarget('project:target', projectGraph)).toEqual([
      'project',
      'target',
    ]);
  });

  it('should split project:target:configuration', () => {
    expect(splitTarget('project:target:configuration', projectGraph)).toEqual([
      'project',
      'target',
      'configuration',
    ]);
  });

  it('should support targets that contain colons when present in the graph', () => {
    expect(
      splitTarget('project:target:target:configuration', projectGraph)
    ).toEqual(['project', 'target:target', 'configuration']);
  });

  it('should return the original string when the target is not present in the graph', () => {
    expect(
      splitTarget('project:other:other:configuration', projectGraph)
    ).toEqual(['project:other:other:configuration']);
  });

  it('should support projects with colons in the name', () => {
    expect(splitTarget(':utils:common:target', projectGraph)).toEqual([
      ':utils:common',
      'target',
    ]);
  });
  it('should support projects with colons in the name and configuration', () => {
    expect(splitTarget(':utils:common:target:dev', projectGraph)).toEqual([
      ':utils:common',
      'target',
      'dev',
    ]);
  });
  it('should use the last matching configuration when there are multiple matches', () => {
    expect(splitTarget(':utils:common:target:prod', projectGraph)).toEqual([
      ':utils:common:target',
      'prod',
    ]);
  });
});
