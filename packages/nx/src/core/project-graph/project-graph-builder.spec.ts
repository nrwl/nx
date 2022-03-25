import { ProjectGraphBuilder } from './project-graph-builder';

describe('ProjectGraphBuilder', () => {
  let builder: ProjectGraphBuilder;
  beforeEach(() => {
    builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'source',
      type: 'lib',
      data: {
        files: [
          {
            file: 'source/index.ts',
          },
          {
            file: 'source/second.ts',
          },
        ],
      },
    });
    builder.addNode({
      name: 'target',
      type: 'lib',
      data: {},
    });
  });

  it(`should add an implicit dependency`, () => {
    expect(() =>
      builder.addImplicitDependency('invalid-source', 'target')
    ).toThrowError();
    expect(() =>
      builder.addImplicitDependency('source', 'invalid-target')
    ).toThrowError();

    // ignore the self deps
    builder.addImplicitDependency('source', 'source');

    // don't include duplicates
    builder.addImplicitDependency('source', 'target');
    builder.addImplicitDependency('source', 'target');

    const graph = builder.getUpdatedProjectGraph();
    expect(graph.dependencies).toEqual({
      source: [
        {
          source: 'source',
          target: 'target',
          type: 'implicit',
        },
      ],
      target: [],
    });
  });

  it(`should add an explicit dependency`, () => {
    expect(() =>
      builder.addExplicitDependency(
        'invalid-source',
        'source/index.ts',
        'target'
      )
    ).toThrowError();
    expect(() =>
      builder.addExplicitDependency(
        'source',
        'source/index.ts',
        'invalid-target'
      )
    ).toThrowError();
    expect(() =>
      builder.addExplicitDependency(
        'source',
        'source/invalid-index.ts',
        'target'
      )
    ).toThrowError();

    // ignore the self deps
    builder.addExplicitDependency('source', 'source/index.ts', 'source');

    // don't include duplicates
    builder.addExplicitDependency('source', 'source/index.ts', 'target');
    builder.addExplicitDependency('source', 'source/second.ts', 'target');

    const graph = builder.getUpdatedProjectGraph();
    expect(graph.dependencies).toEqual({
      source: [
        {
          source: 'source',
          target: 'target',
          type: 'static',
        },
      ],
      target: [],
    });
  });

  it(`should use implicit dep when both implicit and explicit deps are available`, () => {
    // don't include duplicates
    builder.addImplicitDependency('source', 'target');
    builder.addExplicitDependency('source', 'source/index.ts', 'target');

    const graph = builder.getUpdatedProjectGraph();
    expect(graph.dependencies).toEqual({
      source: [
        {
          source: 'source',
          target: 'target',
          type: 'implicit',
        },
      ],
      target: [],
    });
  });

  it(`remove dependency`, () => {
    builder.addNode({
      name: 'target2',
      type: 'lib',
      data: {},
    });
    builder.addImplicitDependency('source', 'target');
    builder.addExplicitDependency('source', 'source/index.ts', 'target');
    builder.addImplicitDependency('source', 'target2');
    builder.removeDependency('source', 'target');

    const graph = builder.getUpdatedProjectGraph();
    expect(graph.dependencies).toEqual({
      source: [
        {
          source: 'source',
          target: 'target2',
          type: 'implicit',
        },
      ],
      target: [],
      target2: [],
    });
  });
});
