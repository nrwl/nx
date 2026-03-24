import { ProjectGraph } from '../config/project-graph';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { splitTarget } from './split-target';

jest.mock('./output', () => ({
  output: {
    warn: jest.fn(),
  },
}));

const { output } = require('./output');

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

  it('should support multi-colon project names when target is not in the graph', () => {
    // :utils:common is in the graph but does NOT have a 'build' target.
    // findAllMatchingSegments can't match, so the fallback path must
    // correctly reconstruct the multi-colon project name.
    expect(splitTarget(':utils:common:build', projectGraph)).toEqual([
      ':utils:common',
      'build',
    ]);
  });

  it('should support triple-colon project names when target is not in the graph', () => {
    // :utils:common:test is in the graph but does NOT have a 'build' target.
    expect(splitTarget(':utils:common:test:build', projectGraph)).toEqual([
      ':utils:common:test',
      'build',
    ]);
  });

  it('should support multi-colon project names with unknown target and configuration', () => {
    // :utils:common is in the graph, 'build' is not a known target,
    // 'prod' trails as configuration.
    expect(splitTarget(':utils:common:build:prod', projectGraph)).toEqual([
      ':utils:common',
      'build',
      'prod',
    ]);
  });
});

describe('ambiguous target resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Scenario 1: a:b:c — project "a" has targets "b:c" and "b" (no configs)
  // Only [a, b:c] is valid because "b" has no config "c".
  it('should prefer colon-bearing target when config does not exist on shorter target', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'a',
      data: {
        root: 'libs/a',
        targets: {
          'b:c': {},
          b: {},
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    expect(splitTarget('a:b:c', graph)).toEqual(['a', 'b:c']);
    expect(output.warn).not.toHaveBeenCalled();
  });

  // Scenario 2: a:b:c — project "a" has targets "b:c" and "b" (with config "c")
  // Both [a, b:c] and [a, b, c] are valid → ambiguous, warn
  it('should warn when both colon-bearing target and target+config are valid', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'a',
      data: {
        root: 'libs/a',
        targets: {
          'b:c': {},
          b: {
            configurations: {
              c: {},
            },
          },
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    // Most specific target name wins: "b:c" > "b"
    expect(splitTarget('a:b:c', graph)).toEqual(['a', 'b:c']);
    expect(output.warn).toHaveBeenCalledTimes(1);
    expect(output.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ambiguous target specifier "a:b:c"',
      })
    );
  });

  // Scenario 3: a:b:c — projects "a" (no targets) and "a:b" (target "c")
  // Only [a:b, c] is valid.
  it('should resolve to most specific project when only one interpretation is valid', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'a',
      data: {
        root: 'libs/a',
        targets: {},
      },
      type: 'lib',
    });
    builder.addNode({
      name: 'a:b',
      data: {
        root: 'libs/ab',
        targets: {
          c: {},
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    expect(splitTarget('a:b:c', graph)).toEqual(['a:b', 'c']);
    expect(output.warn).not.toHaveBeenCalled();
  });

  // Scenario 4: a:b:c — projects "a" (target "b:c") and "a:b" (no targets)
  // Only [a, b:c] is valid.
  it('should resolve to shorter project when longer project has no matching target', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'a',
      data: {
        root: 'libs/a',
        targets: {
          'b:c': {},
        },
      },
      type: 'lib',
    });
    builder.addNode({
      name: 'a:b',
      data: {
        root: 'libs/ab',
        targets: {},
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    expect(splitTarget('a:b:c', graph)).toEqual(['a', 'b:c']);
    expect(output.warn).not.toHaveBeenCalled();
  });

  // Scenario 5: a:b:c — projects "a" (target "b" with config "c") and "a:b" (target "c")
  // Both [a, b, c] and [a:b, c] are valid → ambiguous, warn
  // Most specific project wins: "a:b" > "a"
  it('should warn and prefer most specific project when both interpretations are valid', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'a',
      data: {
        root: 'libs/a',
        targets: {
          b: {
            configurations: {
              c: {},
            },
          },
        },
      },
      type: 'lib',
    });
    builder.addNode({
      name: 'a:b',
      data: {
        root: 'libs/ab',
        targets: {
          c: {},
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    expect(splitTarget('a:b:c', graph)).toEqual(['a:b', 'c']);
    expect(output.warn).toHaveBeenCalledTimes(1);
    expect(output.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ambiguous target specifier "a:b:c"',
      })
    );
  });

  it('should suppress warning when silent option is true', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'a',
      data: {
        root: 'libs/a',
        targets: {
          'b:c': {},
          b: {
            configurations: {
              c: {},
            },
          },
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    expect(splitTarget('a:b:c', graph, { silent: true })).toEqual(['a', 'b:c']);
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('should prefer bare target match when currentProject is provided', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'myapp',
      data: {
        root: 'apps/myapp',
        targets: {
          'build:production': {},
        },
      },
      type: 'app',
    });
    builder.addNode({
      name: 'build',
      data: {
        root: 'libs/build',
        targets: {
          production: {},
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    // With currentProject, bare target "build:production" on myapp wins
    expect(
      splitTarget('build:production', graph, { currentProject: 'myapp' })
    ).toEqual(['myapp', 'build:production']);
    expect(output.warn).toHaveBeenCalledTimes(1);

    output.warn.mockClear();

    // Without currentProject, project "build" with target "production" is the only match
    expect(splitTarget('build:production', graph)).toEqual([
      'build',
      'production',
    ]);
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('should prefer bare target with config over project-based match', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'myapp',
      data: {
        root: 'apps/myapp',
        targets: {
          build: {
            configurations: {
              production: {},
            },
          },
        },
      },
      type: 'app',
    });
    builder.addNode({
      name: 'build',
      data: {
        root: 'libs/build',
        targets: {
          production: {},
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    // With currentProject, bare target "build" config "production" on myapp wins
    expect(
      splitTarget('build:production', graph, { currentProject: 'myapp' })
    ).toEqual(['myapp', 'build', 'production']);
    expect(output.warn).toHaveBeenCalledTimes(1);
  });

  it('should handle leading-colon project names with ambiguity', () => {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: ':a',
      data: {
        root: 'libs/a',
        targets: {
          b: {
            configurations: {
              c: {},
            },
          },
        },
      },
      type: 'lib',
    });
    builder.addNode({
      name: ':a:b',
      data: {
        root: 'libs/ab',
        targets: {
          c: {},
        },
      },
      type: 'lib',
    });
    const graph = builder.getUpdatedProjectGraph();

    // Both [:a, b, c] and [:a:b, c] are valid → ambiguous
    // Most specific project ":a:b" wins
    expect(splitTarget(':a:b:c', graph)).toEqual([':a:b', 'c']);
    expect(output.warn).toHaveBeenCalledTimes(1);
  });
});
