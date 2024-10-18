import type { ProjectGraph } from '../../config/project-graph';
import { parseRunOneOptions } from './run-one';

describe('parseRunOneOptions', () => {
  const projectGraph: ProjectGraph = {
    nodes: {
      project: {
        name: 'project',
        data: {
          root: '',
          targets: {
            target: {
              configurations: {
                dev: {},
              },
            },
            'target:target': {
              configurations: {
                dev: {},
              },
            },
            'hello:world': {},
          },
        },
        type: 'app',
      },
    },
    dependencies: {},
  };

  it('should split format project:target:configuration', () => {
    expect(
      parseRunOneOptions(
        '',
        {
          'project:target:configuration': 'project:target:configuration',
        },
        projectGraph,
        {}
      )
    ).toEqual({
      configuration: 'configuration',
      parsedArgs: {},
      project: 'project',
      target: 'target',
    });

    expect(
      parseRunOneOptions(
        '',
        {
          'project:target:configuration': 'project:target',
        },
        projectGraph,
        {}
      )
    ).toEqual({
      parsedArgs: {},
      project: 'project',
      target: 'target',
    });
  });

  it('should split format target:configuration for default project', () => {
    expect(
      parseRunOneOptions(
        '',
        {
          'project:target:configuration': 'target',
        },
        projectGraph,
        { defaultProject: 'project' }
      )
    ).toEqual({
      parsedArgs: {},
      project: 'project',
      target: 'target',
    });
  });

  it('should parse options with project and target specified', () => {
    expect(
      parseRunOneOptions(
        '',
        {
          project: 'project',
          target: 'target',
        },
        projectGraph,
        { defaultProject: 'project' }
      )
    ).toEqual({
      parsedArgs: {
        target: 'target',
      },
      project: 'project',
      target: 'target',
    });

    expect(
      parseRunOneOptions(
        '',
        {
          project: 'project',
          target: 'target:configuration',
        },
        projectGraph,
        { defaultProject: 'project' }
      )
    ).toEqual({
      parsedArgs: {
        target: 'target:configuration',
      },
      project: 'project',
      target: 'target',
      configuration: 'configuration',
    });

    expect(
      parseRunOneOptions(
        '',
        {
          project: 'project',
          target: 'target:target',
        },
        projectGraph,
        { defaultProject: 'project' }
      )
    ).toEqual({
      parsedArgs: {
        target: 'target:target',
      },
      project: 'project',
      target: 'target:target',
    });
  });
});
