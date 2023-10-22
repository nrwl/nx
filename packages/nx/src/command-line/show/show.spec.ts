import { readNxJson } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { ShowProjectsOptions } from './command-object';
import { showProjectsHandler } from './show';

jest.mock('../../project-graph/project-graph');
jest.mock('../../config/nx-json');

describe('showProjectsHandler', () => {
  let mockGraph: ProjectGraph;
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const processExitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((code?: number) => ({} as never));

  beforeEach(() => {
    jest.clearAllMocks();

    mockGraph = {
      nodes: {
        project1: {
          type: 'app',
          name: 'project1',
          data: {
            root: '',
            description: 'Mock description for project1',
            sourceRoot: 'mock/root/project1',
            projectType: 'application',
          },
        },
        project2: {
          type: 'lib',
          name: 'project2',
          data: {
            root: '',
            description: 'Mock description for project2',
            sourceRoot: 'mock/root/project2',
            projectType: 'library',
          },
        },
        project3: {
          type: 'lib',
          name: 'project3',
          data: {
            root: '',
          },
        },
      },
      dependencies: {},
    };

    (createProjectGraphAsync as jest.Mock).mockResolvedValueOnce(mockGraph);
    (readNxJson as jest.Mock).mockReturnValueOnce({
      npmScope: 'test',
      projects: {},
      tasksRunnerOptions: {
        default: {
          runner: 'test-runner',
          options: {},
        },
      },
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should log all projects when no args are provided', async () => {
    await showProjectsHandler({} as ShowProjectsOptions);

    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'project1');
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'project2');
    expect(consoleLogSpy).toHaveBeenNthCalledWith(3, 'project3');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should log project data attributes when --data arg is provided', async () => {
    await showProjectsHandler({
      data: ['description', 'sourceRoot', 'projectType'],
    } as ShowProjectsOptions);

    expect(consoleLogSpy).toHaveBeenCalledWith('project1');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\tdescription "Mock description for project1"'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\tsourceRoot  "mock/root/project1"'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('\tprojectType "application"');

    expect(consoleLogSpy).toHaveBeenCalledWith('project2');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\tdescription "Mock description for project2"'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\tsourceRoot  "mock/root/project2"'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('\tprojectType "library"');

    expect(consoleLogSpy).toHaveBeenCalledWith('project3');
    expect(consoleLogSpy).toHaveBeenCalledWith('\tdescription ""');
    expect(consoleLogSpy).toHaveBeenCalledWith('\tsourceRoot  ""');
    expect(consoleLogSpy).toHaveBeenCalledWith('\tprojectType "library"');

    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
