import { TasksRunner } from './tasks-runner';
import defaultTaskRunner from './default-tasks-runner';
import { createTasksForProjectToRun, getRunner } from './run-command';
import { DependencyType, ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';

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
    projectGraph.nodes.app1.data.targets.build.configurations =
      projectGraph.nodes.lib1.data.targets.build.configurations = {
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

  it('should create tasks for multiple sets of dependencies for multiple targets', () => {
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'prebuild',
        projects: 'dependencies',
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

    projectGraph.nodes.lib1.data.targets.prebuild = {};

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
        id: 'lib1:prebuild',
        overrides: {},
        projectRoot: 'lib1-root',
        target: {
          configuration: undefined,
          project: 'lib1',
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

  it('should include dependencies of projects without the same target', () => {
    // App 1 depends on builds of its dependencies
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];

    // App 1 depends on Lib 1
    projectGraph.dependencies.app1.push({
      type: DependencyType.static,
      source: 'app1',
      target: 'lib1',
    });

    // Lib 1 does not have build but depends on Lib 2
    delete projectGraph.nodes.lib1.data.targets.build;
    projectGraph.dependencies.lib1.push({
      type: DependencyType.static,
      source: 'lib1',
      target: 'lib2',
    });

    // Lib 2 has a build
    projectGraph.nodes.lib2 = {
      name: 'lib2',
      type: 'lib',
      data: {
        root: 'lib2-root',
        files: [],
        targets: {
          build: {},
        },
      },
    };
    projectGraph.dependencies.lib2 = [];

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

    expect(tasks).toContainEqual({
      id: 'app1:build',
      target: { project: 'app1', target: 'build' },
      projectRoot: 'app1-root',
      overrides: {},
    });
    expect(tasks).toContainEqual({
      id: 'lib2:build',
      target: { project: 'lib2', target: 'build' },
      projectRoot: 'lib2-root',
      overrides: {},
    });
  });

  it('should handle APP1 <=> LIB1(no build) => LIB2', () => {
    // APP1 <=> LIB1 => LIB2
    // App 1 depends on builds of its dependencies
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];

    // App 1 depends on Lib 1
    projectGraph.dependencies.app1.push({
      type: DependencyType.static,
      source: 'app1',
      target: 'lib1',
    });

    // Lib 1 does not have build but depends on Lib 2
    delete projectGraph.nodes.lib1.data.targets.build;
    projectGraph.dependencies.lib1.push(
      {
        type: DependencyType.static,
        source: 'lib1',
        target: 'app1',
      },
      {
        type: DependencyType.static,
        source: 'lib1',
        target: 'lib2',
      }
    );

    // Lib 2 has a build
    projectGraph.nodes.lib2 = {
      name: 'lib2',
      type: 'lib',
      data: {
        root: 'lib2-root',
        files: [],
        targets: {
          build: {},
        },
      },
    };
    projectGraph.dependencies.lib2 = [];

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

    expect(tasks).toContainEqual({
      id: 'app1:build',
      target: { project: 'app1', target: 'build' },
      projectRoot: 'app1-root',
      overrides: {},
    });
    expect(tasks).toContainEqual({
      id: 'lib2:build',
      target: { project: 'lib2', target: 'build' },
      projectRoot: 'lib2-root',
      overrides: {},
    });
  });

  it('should error when APP1 <=> LIB1(no build) <=> LIB2', () => {
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error();
    });

    // Define Lib 2 with a build
    projectGraph.nodes.lib2 = {
      name: 'lib2',
      type: 'lib',
      data: {
        root: 'lib2-root',
        files: [],
        targets: {
          build: {},
        },
      },
    };

    // Lib 1 does not have "build"
    delete projectGraph.nodes.lib1.data.targets.build;

    // APP1 <=> LIB1 <=> LIB2
    projectGraph.nodes.app1.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];

    projectGraph.nodes.lib2.data.targets.build.dependsOn = [
      {
        target: 'build',
        projects: 'dependencies',
      },
    ];

    // App 1 depends on Lib 1
    projectGraph.dependencies.app1.push({
      type: DependencyType.static,
      source: 'app1',
      target: 'lib1',
    });

    projectGraph.dependencies.lib1.push(
      {
        type: DependencyType.static,
        source: 'lib1',
        target: 'app1',
      },
      {
        type: DependencyType.static,
        source: 'lib1',
        target: 'lib2',
      }
    );

    projectGraph.dependencies.lib2 = [
      {
        type: DependencyType.static,
        source: 'lib2',
        target: 'lib1',
      },
    ];

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

  // Technically, this could work but it creates a lot of problems in the implementation,
  // so instead we error saying that the circular dependency cannot be handled.
  // xit('should handle APP1 => LIB1(no build) <=> LIB2', () => {
  // });

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

  it('should forward overrides to tasks with the same target executor', () => {
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
    projectGraph.nodes.app1.data.targets.build.executor = 'executor1';
    projectGraph.nodes.lib1.data.targets.build.executor = 'executor1';
    projectGraph.nodes.app1.data.targets.prebuild.executor = 'executor2';
    projectGraph.nodes.lib2 = {
      data: {
        root: 'lib2-root',
        files: [],
        targets: { build: { executor: 'executor2' } },
      },
      name: 'lib2',
      type: 'lib',
    };
    projectGraph.dependencies.lib2 = [];
    projectGraph.dependencies.app1.push(
      {
        type: DependencyType.static,
        source: 'app1',
        target: 'lib1',
      },
      {
        type: DependencyType.static,
        source: 'app1',
        target: 'lib2',
      }
    );

    const tasks = createTasksForProjectToRun(
      [projectGraph.nodes.app1],
      {
        target: 'build',
        configuration: undefined,
        overrides: { myFlag: 'flag value' },
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
        overrides: { myFlag: 'flag value' },
        projectRoot: 'lib1-root',
        target: {
          configuration: undefined,
          project: 'lib1',
          target: 'build',
        },
      },
      {
        id: 'lib2:build',
        overrides: {},
        projectRoot: 'lib2-root',
        target: {
          configuration: undefined,
          project: 'lib2',
          target: 'build',
        },
      },
      {
        id: 'app1:build',
        overrides: { myFlag: 'flag value' },
        projectRoot: 'app1-root',
        target: {
          configuration: undefined,
          project: 'app1',
          target: 'build',
        },
      },
    ]);
  });
});

describe('getRunner', () => {
  let nxJson: NxJsonConfiguration;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
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
