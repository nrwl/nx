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

    projectGraph = builder.getUpdatedProjectGraph();
  });

  it('should support only project', () => {
    expect(splitTarget('project', projectGraph)).toEqual(['project']);
  });

  it('should project:target', () => {
    expect(splitTarget('project:target', projectGraph)).toEqual([
      'project',
      'target',
    ]);
  });

  it('should project:target:configuration', () => {
    expect(splitTarget('project:target:configuration', projectGraph)).toEqual([
      'project',
      'target',
      'configuration',
    ]);
  });

  it('should targets that contain colons when present in the graph', () => {
    expect(
      splitTarget('project:target:target:configuration', projectGraph)
    ).toEqual(['project', 'target:target', 'configuration']);
  });

  it('should targets that contain colons when not present in the graph but surrounded by quotes', () => {
    expect(
      splitTarget('project:"other:other":configuration', projectGraph)
    ).toEqual(['project', 'other:other', 'configuration']);
  });

  it('should targets that contain colons when not provided graph but surrounded by quotes', () => {
    expect(
      splitTarget('project:"other:other":configuration', {
        nodes: {},
        dependencies: {},
      } as ProjectGraph)
    ).toEqual(['project', 'other:other', 'configuration']);
  });
});
