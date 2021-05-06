import { ProjectGraphBuilder } from './project-graph-builder';
import { DependencyType, ProjectGraphNode } from './project-graph-models';

describe('ProjectGraphBuilder', () => {
  it('should generate graph with nodes and dependencies', () => {
    const builder = new ProjectGraphBuilder();
    const myapp = createNode('myapp', 'app');
    const libA = createNode('lib-a', 'lib');
    const libB = createNode('lib-b', 'lib');
    const libC = createNode('lib-c', 'lib');
    const happyNrwl = createNode('happy-nrwl', 'npm');
    builder.addNode(myapp);
    builder.addNode(libA);
    builder.addNode(libB);
    builder.addNode(libC);
    builder.addNode(libC); // Idempotency
    builder.addNode(happyNrwl);

    expect(() => {
      builder.addDependency(DependencyType.static, 'fake-1', 'fake-2');
    }).toThrow();

    builder.addDependency(DependencyType.static, myapp.name, libA.name);
    builder.addDependency(DependencyType.static, myapp.name, libB.name);
    builder.addDependency(DependencyType.static, libB.name, libC.name);
    builder.addDependency(DependencyType.static, libB.name, libC.name); // Idempotency
    builder.addDependency(DependencyType.static, libB.name, libB.name);
    builder.addDependency(DependencyType.static, libC.name, happyNrwl.name);

    const graph = builder.build();

    expect(graph).toMatchObject({
      nodes: {
        [myapp.name]: myapp,
        [libA.name]: libA,
        [libB.name]: libB,
        [libC.name]: libC,
        [happyNrwl.name]: happyNrwl,
      },
      dependencies: {
        [myapp.name]: [
          {
            type: DependencyType.static,
            source: myapp.name,
            target: libA.name,
          },
          {
            type: DependencyType.static,
            source: myapp.name,
            target: libB.name,
          },
        ],
        [libB.name]: [
          { type: DependencyType.static, source: libB.name, target: libC.name },
        ],
        [libC.name]: [
          {
            type: DependencyType.static,
            source: libC.name,
            target: happyNrwl.name,
          },
        ],
      },
    });
  });

  it('should throw an error when there are projects with conflicting names', () => {
    const builder = new ProjectGraphBuilder();
    const projA = createNode('proj', 'app');
    const projB = createNode('proj', 'lib');
    builder.addNode(projA);

    expect(() => {
      builder.addNode(projB);
    }).toThrow();
  });
});

function createNode(name: string, type: string): ProjectGraphNode {
  return {
    type,
    name,
    data: null,
  };
}
