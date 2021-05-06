import { TasksRunner } from './tasks-runner';
import defaultTaskRunner from './default-tasks-runner';
import { createTasksForProjectToRun, getRunner } from './run-command';
import { NxJson } from '../core/shared-interfaces';
import { DependencyType, ProjectGraph } from '@nrwl/devkit';

describe('createTasksForProjectToRun', () => {
  let projectGraph: ProjectGraph;
  beforeEach(() => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              prebuild: {},
              build: {},
              serve: {},
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
      },
      dependencies: {
        app1: [],
        lib1: [],
      },
    };
  });

  it('should create the task for the project and target passed', () => {
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1],
      {
        target: 'serve',
        configuration: undefined,
        overrides: {},
      },
      projectGraph,
      null
    );

    expect(tasks).toEqual([
      {
        id: 'app1:serve',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'serve',
        },
      },
    ]);
  });

  it('should create the task for multiple projects passed', () => {
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1, projectGraph.nodes.lib1],
      {
        target: 'build',
        configuration: undefined,
        overrides: {},
      },
      projectGraph,
      null
    );

    expect(tasks).toEqual([
      {
        id: 'app1:build',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'build',
        },
      },
      {
        id: 'lib1:build',
        overrides: {},
        projectRoot: 'lib1-root',
        target: {
          configuration: undefined,
          project: 'lib1',
          target: 'build',
        },
      },
    ]);
  });

  it('should create the tasks for multiple projects passed with configuration', () => {
    projectGraph.nodes.app1.data.targets.build.configurations = projectGraph.nodes.lib1.data.targets.build.configurations = {
      production: {},
    };
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1, projectGraph.nodes.lib1],
      {
        target: 'build',
        configuration: 'production',
        overrides: {},
      },
      projectGraph,
      null
    );

    expect(tasks).toEqual([
      {
        id: 'app1:build:production',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: 'production',
          project: 'app1',
          target: 'build',
        },
      },
      {
        id: 'lib1:build:production',
        overrides: {},
        projectRoot: 'lib1-root',
        target: {
          configuration: 'production',
          project: 'lib1',
          target: 'build',
        },
      },
    ]);
  });

  it('should create the tasks for multiple projects passed with configuration and fallback to default configuration', () => {
    projectGraph.nodes.app1.data.targets.build.configurations = {
      production: {},
    };
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1, projectGraph.nodes.lib1],
      {
        target: 'build',
        configuration: 'production',
        overrides: {},
      },
      projectGraph,
      null
    );

    expect(tasks).toEqual([
      {
        id: 'app1:build:production',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: 'production',
          project: 'app1',
          target: 'build',
        },
      },
      {
        id: 'lib1:build',
        overrides: {},
        projectRoot: 'lib1-root',
        target: {
          project: 'lib1',
          target: 'build',
        },
      },
    ]);
  });

  it('should create tasks for self dependencies', () => {
    projectGraph.nodes.app1.data.targets.serve.dependsOn = [
      {
        target: 'build',
        projects: 'self',
      },
    ];
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1],
      {
        target: 'serve',
        configuration: undefined,
        overrides: {},
      },
      projectGraph,
      projectGraph.nodes.app1.name
    );

    expect(tasks).toEqual([
      {
        id: 'app1:build',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'build',
        },
      },
      {
        id: 'app1:serve',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'serve',
        },
      },
    ]);
  });

  it('should create tasks for target dependencies', () => {
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];
    projectGraph.dependencies.app1.push({
      type: DependencyType.static,
      source: 'app1',
      target: 'lib1',
    });
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1],
      {
        target: 'build',
        configuration: undefined,
        overrides: {},
      },
      projectGraph,
      projectGraph.nodes.app1.name
    );

    expect(tasks).toEqual([
      {
        id: 'lib1:build',
        overrides: {},
        projectRoot: 'lib1-root',
        target: {
          configuration: undefined,
          project: 'lib1',
          target: 'build',
        },
      },
      {
        id: 'app1:build',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'build',
        },
      },
    ]);
  });

  it('should create tasks for multiple sets of dependencies', () => {
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'prebuild',
        projects: 'self',
      },
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];
    projectGraph.dependencies.app1.push({
      type: DependencyType.static,
      source: 'app1',
      target: 'lib1',
    });
    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1],
      {
        target: 'build',
        configuration: undefined,
        overrides: {},
      },
      projectGraph,
      projectGraph.nodes.app1.name
    );

    expect(tasks).toEqual([
      {
        id: 'app1:prebuild',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'prebuild',
        },
      },
      {
        id: 'lib1:build',
        overrides: {},
        projectRoot: 'lib1-root',
        target: {
          configuration: undefined,
          project: 'lib1',
          target: 'build',
        },
      },
      {
        id: 'app1:build',
        overrides: {},
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'build',
        },
      },
    ]);
  });

  it('should throw an error for an invalid target', () => {
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error();
    });
    try {
      createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'invalid',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );
      fail();
    } catch (e) {
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  });

  it('should throw an error for an invalid configuration for the initiating project', () => {
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error();
    });
    try {
      createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'serve',
          configuration: 'invalid',
          overrides: {},
        },
        projectGraph,
        'app1'
      );
      fail();
    } catch (e) {
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  });

  it('should throw an error for circular dependencies', () => {
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];
    projectGraph.nodes.lib1.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];
    projectGraph.dependencies.app1.push({
      type: DependencyType.static,
      source: 'app1',
      target: 'lib1',
    });
    projectGraph.dependencies.lib1.push({
      type: DependencyType.static,
      source: 'lib1',
      target: 'app1',
    });
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error();
    });
    try {
      createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        projectGraph.nodes.app1.name
      );
      fail();
    } catch (e) {
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  });

  it('should throw an error for depending on a non-existent target of itself', () => {
    projectGraph.nodes.app1.data.targets.serve.dependsOn = [
      {
        target: 'non-existent',
        projects: 'self',
      },
    ];
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error();
    });
    try {
      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'serve',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        projectGraph.nodes.app1.name
      );
      fail();
    } catch (e) {
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  });

  it('should throw an error for circular dependencies in tasks', () => {
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'serve',
        projects: 'self',
      },
    ];
    projectGraph.nodes.app1.data.targets.serve.dependsOn = [
      {
        target: 'build',
        projects: 'self',
      },
    ];
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error();
    });
    try {
      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );
      fail();
    } catch (e) {
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  });
});

describe('getRunner', () => {
  let nxJson: NxJson;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
      projects: {},
    };
    mockRunner = jest.fn();
  });

  it('gets a default runner when runner is not defined in the nx json', () => {
    const { tasksRunner, runnerOptions } = getRunner({}, nxJson);

    expect(tasksRunner).toEqual(defaultTaskRunner);
  });

  it('gets a default runner when default options are not configured', () => {
    const { tasksRunner, runnerOptions } = getRunner({}, nxJson);

    expect(tasksRunner).toEqual(defaultTaskRunner);
  });

  it('gets a custom task runner', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner',
      },
    };

    const { tasksRunner, runnerOptions } = getRunner(
      { runner: 'custom' },
      nxJson
    );

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('gets a custom task runner with options', () => {
    jest.mock('custom-runner2', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner2',
        options: {
          runnerOption: 'runner-option',
        },
      },
    };

    const { tasksRunner, runnerOptions } = getRunner(
      { runner: 'custom' },
      nxJson
    );
    expect(tasksRunner).toBe(mockRunner);
    expect(runnerOptions).toEqual({
      runner: 'custom',
      runnerOption: 'runner-option',
    });
  });

  it('gets a custom defined default task runner', () => {
    jest.mock('custom-default-runner', () => mockRunner, {
      virtual: true,
    });

    nxJson.tasksRunnerOptions = {
      default: {
        runner: 'custom-default-runner',
      },
    };

    const { tasksRunner } = getRunner({}, nxJson);

    expect(tasksRunner).toEqual(mockRunner);
  });
});
