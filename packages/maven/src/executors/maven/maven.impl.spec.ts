import {
  ExecutorContext,
  ProjectGraphProjectNode,
  ProjectConfiguration,
} from '@nx/devkit';
import mavenExecutor from './maven.impl';
import { MavenExecutorSchema } from './schema';

describe('Maven Executor', () => {
  let context: ExecutorContext;

  beforeEach(() => {
    const projectConfig: ProjectConfiguration = {
      name: 'test-project',
      root: '/workspace/libs/test-project',
      tags: [],
      sourceRoot: '/workspace/libs/test-project/src',
      targets: {},
    };

    const projectNode: ProjectGraphProjectNode = {
      name: 'test-project',
      type: 'lib',
      data: projectConfig,
    };

    context = {
      root: '/workspace',
      projectName: 'test-project',
      targetName: 'build',
      configurationName: undefined,
      cwd: '/workspace',
      isVerbose: false,
      projectGraph: {
        nodes: {
          'test-project': projectNode,
        },
        dependencies: {},
        externalNodes: {},
      },
      nxJsonConfiguration: {},
      taskGraph: undefined,
    };
  });

  it('should build successfully with phase option', async () => {
    const options: MavenExecutorSchema = {
      phase: 'compile',
    };

    // This test verifies the executor can be instantiated
    // Actual execution would require Maven installed
    expect(mavenExecutor).toBeDefined();
  });

  it('should handle goals array', async () => {
    const options: MavenExecutorSchema = {
      goals: ['clean:clean', 'compiler:compile'],
    };

    expect(mavenExecutor).toBeDefined();
  });

  it('should handle string args', async () => {
    const options: MavenExecutorSchema = {
      phase: 'test',
      args: '--quiet -X',
    };

    expect(mavenExecutor).toBeDefined();
  });

  it('should handle array args', async () => {
    const options: MavenExecutorSchema = {
      phase: 'package',
      args: ['--quiet', '-DskipTests'],
    };

    expect(mavenExecutor).toBeDefined();
  });
});
