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
      } as any,
    });
    builder.addNode({
      name: 'target',
      type: 'lib',
      data: {} as any,
    });
  });

  it(`should add a dependency`, () => {
    expect(() =>
      builder.addImplicitDependency('invalid-source', 'target')
    ).toThrowError();
    expect(() =>
      builder.addImplicitDependency('source', 'invalid-target')
    ).toThrowError();

    // ignore the self deps
    builder.addDynamicDependency('source', 'source', 'source/index.ts');

    // don't include duplicates of the same type
    builder.addImplicitDependency('source', 'target');
    builder.addImplicitDependency('source', 'target');
    builder.addStaticDependency('source', 'target', 'source/index.ts');
    builder.addDynamicDependency('source', 'target', 'source/index.ts');
    builder.addStaticDependency('source', 'target', 'source/index.ts');

    const graph = builder.getUpdatedProjectGraph();
    expect(graph.dependencies).toEqual({
      source: [
        {
          source: 'source',
          target: 'target',
          type: 'implicit',
        },
        {
          source: 'source',
          target: 'target',
          type: 'static',
        },
        {
          source: 'source',
          target: 'target',
          type: 'dynamic',
        },
      ],
      target: [],
    });
  });

  it(`should add an implicit dependency`, () => {
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

  it(`should use both deps when both implicit and explicit deps are available`, () => {
    // don't include duplicates
    builder.addImplicitDependency('source', 'target');
    builder.addStaticDependency('source', 'target', 'source/index.ts');

    const graph = builder.getUpdatedProjectGraph();
    expect(graph.dependencies).toEqual({
      source: [
        {
          source: 'source',
          target: 'target',
          type: 'implicit',
        },
        {
          source: 'source',
          target: 'target',
          type: 'static',
        },
      ],
      target: [],
    });
  });

  it(`should record deps for all files when duplicated`, () => {
    builder.addStaticDependency('source', 'target', 'source/index.ts');
    builder.addStaticDependency('source', 'target', 'source/second.ts');

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
    expect(graph.nodes.source.data.files[0]).toMatchObject({
      file: 'source/index.ts',
      dependencies: [
        {
          source: 'source',
          target: 'target',
          type: 'static',
        },
      ],
    });
    expect(graph.nodes.source.data.files[1]).toMatchObject({
      file: 'source/second.ts',
      dependencies: [
        {
          source: 'source',
          target: 'target',
          type: 'static',
        },
      ],
    });
  });

  it(`remove dependency`, () => {
    builder.addNode({
      name: 'target2',
      type: 'lib',
      data: {} as any,
    });
    builder.addImplicitDependency('source', 'target');
    builder.addStaticDependency('source', 'target', 'source/index.ts');
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
