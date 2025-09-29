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
          'target:with:colon': {},
        },
      },
      type: 'app',
    });
    builder.addNode({
      name: ':utils:common:test',
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

  it('should targets that contain colons when not present in the graph but surrounded by quotes', () => {
    expect(
      splitTarget('project:"other:other":configuration', projectGraph)
    ).toEqual(['project', 'other:other', 'configuration']);
  });

  it('should support projects with colons in the name', () => {
    expect(splitTarget(':utils:common:target', projectGraph)).toEqual([
      ':utils:common',
      'target',
    ]);
  });

  it('should support projects and targets with colons in the name', () => {
    expect(
      splitTarget(':utils:common:target:with:colon', projectGraph)
    ).toEqual([':utils:common', 'target:with:colon']);
  });

  it('should support projects with colons in the name and configuration', () => {
    expect(splitTarget(':utils:common:target:dev', projectGraph)).toEqual([
      ':utils:common',
      'target',
      'dev',
    ]);
  });
});
