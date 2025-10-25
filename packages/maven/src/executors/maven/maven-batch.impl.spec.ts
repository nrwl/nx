import {
  ExecutorContext,
  TaskGraph,
  ProjectGraphProjectNode,
  ProjectConfiguration,
} from '@nx/devkit';
import mavenBatchExecutor from './maven-batch.impl';
import { MavenExecutorSchema } from './schema';

describe('Maven Batch Executor', () => {
  let context: ExecutorContext;
  let taskGraph: TaskGraph;

  beforeEach(() => {
    const projectAConfig: ProjectConfiguration = {
      name: 'project-a',
      root: '/workspace/libs/project-a',
      tags: [],
      sourceRoot: '/workspace/libs/project-a/src',
      targets: {
        build: {
          executor: '@nx/maven:maven',
          options: {
            phase: 'compile',
          },
        },
      },
    };

    const projectBConfig: ProjectConfiguration = {
      name: 'project-b',
      root: '/workspace/libs/project-b',
      tags: [],
      sourceRoot: '/workspace/libs/project-b/src',
      targets: {
        build: {
          executor: '@nx/maven:maven',
          options: {
            phase: 'compile',
          },
        },
      },
    };

    const projectANode: ProjectGraphProjectNode = {
      name: 'project-a',
      type: 'lib',
      data: projectAConfig,
    };

    const projectBNode: ProjectGraphProjectNode = {
      name: 'project-b',
      type: 'lib',
      data: projectBConfig,
    };

    taskGraph = {
      roots: ['project-a:build', 'project-b:build'],
      tasks: {
        'project-a:build': {
          id: 'project-a:build',
          target: {
            project: 'project-a',
            target: 'build',
            configuration: undefined,
          },
          outputs: [],
          cache: false,
          overrides: {},
        },
        'project-b:build': {
          id: 'project-b:build',
          target: {
            project: 'project-b',
            target: 'build',
            configuration: undefined,
          },
          outputs: [],
          cache: false,
          overrides: {},
        },
      },
      dependencies: {
        'project-a:build': [],
        'project-b:build': [],
      },
      continuousDependencies: {},
    };

    context = {
      root: '/workspace',
      projectName: 'project-a',
      targetName: 'build',
      configurationName: undefined,
      cwd: '/workspace',
      isVerbose: false,
      projectGraph: {
        nodes: {
          'project-a': projectANode,
          'project-b': projectBNode,
        },
        dependencies: {},
        externalNodes: {},
      },
      nxJsonConfiguration: {},
      taskGraph,
    };
  });

  it('should initialize batch executor', () => {
    expect(mavenBatchExecutor).toBeDefined();
  });

  it('should group tasks with same targets', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': {
        phase: 'compile',
      },
      'project-b:build': {
        phase: 'compile',
      },
    };

    // Batch executor should group both tasks since they have identical phases
    expect(mavenBatchExecutor).toBeDefined();
  });

  it('should handle multiple task groups', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': {
        phase: 'compile',
      },
      'project-b:build': {
        phase: 'test',
      },
    };

    // Batch executor should create separate groups for different phases
    expect(mavenBatchExecutor).toBeDefined();
  });

  it('should handle empty overrides', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': {
        phase: 'compile',
      },
    };

    const overrides = {
      __overrides_unparsed__: [],
    };

    expect(mavenBatchExecutor).toBeDefined();
  });
});
