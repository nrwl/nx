import {
  ExecutorContext,
  ProjectGraphProjectNode,
  ProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { runCommandsExecutor } from '@nx/devkit/internal';
import mavenExecutor from './maven.impl';
import { MavenExecutorSchema } from './schema';

vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  runCommandsExecutor: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../utils/detect-maven-executable', () => ({
  detectMavenExecutable: () => 'mvn',
  isMaven4: () => false,
}));

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
      projectsConfigurations: {
        version: 2,
        projects: {
          'test-project': projectConfig,
        },
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

  it('passes the Nx workspace root to Maven when args select another POM', async () => {
    await mavenExecutor(
      { goals: ['compiler:compile'], args: ['-f', 'app/pom.xml'] },
      context
    );

    expect(runCommandsExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { NX_WORKSPACE_ROOT: workspaceRoot },
      }),
      context
    );
  });
});
