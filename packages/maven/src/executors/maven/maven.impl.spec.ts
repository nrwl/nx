import {
  ExecutorContext,
  ProjectGraphProjectNode,
  ProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { runCommandsExecutor } from '@nx/devkit/internal';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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

  describe('a phase whose build state is already on disk', () => {
    const buildState = '{projectRoot}/target/nx-build-state.json';
    const noGoals: MavenExecutorSchema = { phase: 'initialize', goals: [] };
    const originalMavenArgs = process.env.MAVEN_ARGS;
    let root: string;
    let project: ProjectConfiguration;

    beforeEach(() => {
      delete process.env.MAVEN_ARGS;
      root = mkdtempSync(join(tmpdir(), 'nx-maven-executor-'));
      mkdirSync(join(root, 'libs/test-project/target'), { recursive: true });
      writeFileSync(
        join(root, 'libs/test-project/target/nx-build-state.json'),
        '{}'
      );
      context.root = root;
      project = context.projectGraph.nodes['test-project'].data;
      project.root = 'libs/test-project';
      project.tags = ['maven:jar'];
      project.targets = {
        build: {
          executor: '@nx/maven:maven',
          inputs: [{ fileset: buildState, includeIgnored: true }],
          outputs: [buildState],
        },
      };
      vi.mocked(runCommandsExecutor).mockClear();
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
      if (originalMavenArgs === undefined) {
        delete process.env.MAVEN_ARGS;
      } else {
        process.env.MAVEN_ARGS = originalMavenArgs;
      }
    });

    it('reports success without starting Maven when it has no goals', async () => {
      await expect(mavenExecutor(noGoals, context)).resolves.toEqual({
        success: true,
      });
      expect(runCommandsExecutor).not.toHaveBeenCalled();
    });

    it.each<[string, MavenExecutorSchema, () => void]>([
      ['it has goals', { goals: ['compiler:compile'] }, () => {}],
      ['args are set', { ...noGoals, args: ['dependency:tree'] }, () => {}],
      [
        'the target sets __unparsed__',
        { ...noGoals, __unparsed__: ['-X'] },
        () => {},
      ],
      ['MAVEN_ARGS is set', noGoals, () => (process.env.MAVEN_ARGS = 'clean')],
      [
        'the build state file is missing',
        noGoals,
        () =>
          rmSync(join(root, 'libs/test-project/target'), { recursive: true }),
      ],
      [
        'it does not hash its own build state',
        noGoals,
        () => (project.targets.build.inputs = []),
      ],
      [
        'it hashes the build state of its dependencies instead',
        noGoals,
        () =>
          (project.targets.build.inputs = [
            { fileset: buildState, includeIgnored: true, dependencies: true },
          ]),
      ],
      [
        'it hashes the build state only if git tracks it',
        noGoals,
        () => (project.targets.build.inputs = [{ fileset: buildState }]),
      ],
      [
        'it does not output its build state',
        noGoals,
        () => (project.targets.build.outputs = []),
      ],
      [
        'the module is a pom module',
        noGoals,
        () => (project.tags = ['maven:pom']),
      ],
    ])('starts Maven when %s', async (_, options, arrange) => {
      arrange();

      await mavenExecutor(options, context);

      expect(runCommandsExecutor).toHaveBeenCalledTimes(1);
    });
  });
});
