import { source } from '@angular-devkit/schematics';
import { createCommandGraph } from './create-command-graph';
import { CommandGraph } from './command-graph';

export { createCommandGraph } from './create-command-graph';

describe('createCommandGraph', () => {
  it('should create command graph with empty dependencies', () => {
    const projectGraph = {
      dependencies: {},
      nodes: {},
    };
    const projectNames = [];
    const nxArgs = {};
    const result = createCommandGraph(projectGraph, projectNames, nxArgs);
    expect(result).toEqual({ dependencies: {}, roots: [] });
  });

  it('should create command graph with dependencies', () => {
    const projectGraph = {
      dependencies: {
        dep1: [{ target: 'dep2', type: 'static', source: 'dep1' }],
        dep2: [],
      },
      nodes: {
        dep1: {
          type: 'lib' as 'lib',
          name: 'dep1',
          data: {
            files: [],
            root: 'dep1',
          },
        },
        dep2: {
          type: 'lib' as 'lib',
          name: 'dep2',
          data: {
            files: [],
            root: 'dep2',
          },
        },
      },
    };
    const projectNames = ['dep1'];
    const nxArgs = {};
    const result = createCommandGraph(projectGraph, projectNames, nxArgs);
    expect(result).toEqual({
      dependencies: { dep1: ['dep2'], dep2: [] },
      roots: ['dep2'],
    });
  });

  it('should create command graph with nested dependencies', () => {
    const projectGraph = {
      dependencies: {
        dep1: [{ target: 'dep2', type: 'static', source: 'dep1' }],
        dep2: [],
        dep3: [{ target: 'dep1', type: 'static', source: 'dep3' }],
      },
      nodes: {
        dep1: {
          type: 'lib' as 'lib',
          name: 'dep1',
          data: {
            files: [],
            root: 'dep1',
          },
        },
        dep2: {
          type: 'lib' as 'lib',
          name: 'dep2',
          data: {
            files: [],
            root: 'dep2',
          },
        },
        dep3: {
          type: 'lib' as 'lib',
          name: 'dep3',
          data: {
            files: [],
            root: 'dep3',
          },
        },
      },
    };
    const result = createCommandGraph(
      projectGraph,
      ['dep1', 'dep2', 'dep3'],
      {}
    );
    expect(result).toEqual({
      dependencies: { dep1: ['dep2'], dep2: [], dep3: ['dep1'] },
      roots: ['dep2'],
    });
  });
});
