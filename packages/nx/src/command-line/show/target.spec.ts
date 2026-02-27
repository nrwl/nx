import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import type { HashInputs } from '../../native';
import {
  showTargetInfoHandler,
  showTargetInputsHandler,
  showTargetOutputsHandler,
} from './target';

let graph: ProjectGraph = {
  nodes: {},
  dependencies: {},
  externalNodes: {},
};

let mockCwd = '/workspace';
let mockNxJson: Record<string, unknown> = {};
let mockHashInputs: Record<string, HashInputs> = {};
let mockExpandedOutputs: string[] | null = null;

jest.mock('../../project-graph/project-graph', () => ({
  ...(jest.requireActual(
    '../../project-graph/project-graph'
  ) as typeof import('../../project-graph/project-graph')),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(graph)),
}));

jest.mock('../../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

jest.mock('../../utils/output', () => ({
  output: {
    error: jest.fn(),
    drain: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn().mockImplementation(() => mockNxJson),
}));

jest.mock('../../native', () => {
  const actual = jest.requireActual('../../native');
  return {
    ...actual,
    expandOutputs: jest
      .fn()
      .mockImplementation((_root: string, outputs: string[]) => {
        if (mockExpandedOutputs !== null) return mockExpandedOutputs;
        return actual.expandOutputs(_root, outputs);
      }),
  };
});

jest.mock('../../hasher/hash-plan-inspector', () => ({
  HashPlanInspector: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    inspectTaskInputs: jest.fn().mockImplementation(() => mockHashInputs),
  })),
}));

const originalCwd = process.cwd;

performance.mark = jest.fn();
performance.measure = jest.fn();

describe('show target', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    performance.mark('init-local');
    mockCwd = '/workspace';
    mockNxJson = {};
    mockHashInputs = {};
    mockExpandedOutputs = null;
    process.exitCode = undefined;
    process.cwd = jest.fn().mockReturnValue(mockCwd);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.cwd = originalCwd;
  });

  it('should show target info when project:target is provided', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              options: { outputPath: 'dist/apps/my-app' },
            },
          },
        },
        'app'
      )
      .build();

    await showTargetInfoHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.project).toBe('my-app');
    expect(parsed.target).toBe('build');
    expect(parsed.executor).toBe('@nx/web:build');
    expect(parsed.options).toEqual({ outputPath: 'dist/apps/my-app' });
  });

  it('should infer project from cwd when only target name given', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: { executor: '@nx/web:build' },
          },
        },
        'app'
      )
      .build();

    process.cwd = jest.fn().mockReturnValue('/workspace/apps/my-app');

    await showTargetInfoHandler({
      target: 'build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.project).toBe('my-app');
    expect(parsed.target).toBe('build');
  });

  it('should output valid JSON with expected structure', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              options: { outputPath: 'dist/apps/my-app' },
              outputs: ['{options.outputPath}'],
              inputs: ['default', '^default'],
              cache: true,
              configurations: {
                production: { optimization: true },
              },
              defaultConfiguration: 'production',
            },
          },
        },
        'app'
      )
      .build();

    await showTargetInfoHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed).toMatchObject({
      project: 'my-app',
      target: 'build',
      executor: '@nx/web:build',
      options: { outputPath: 'dist/apps/my-app' },
      inputs: [{ fileset: '{projectRoot}/**/*' }, '^default'],
      outputs: ['{options.outputPath}'],
      configurations: ['production'],
      defaultConfiguration: 'production',
      cache: true,
      parallelism: true,
    });
  });

  it('should merge configuration options correctly', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              options: { outputPath: 'dist/apps/my-app', optimization: false },
              configurations: {
                production: { optimization: true, sourceMap: false },
              },
            },
          },
        },
        'app'
      )
      .build();

    await showTargetInfoHandler({
      target: 'my-app:build',
      configuration: 'production',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.options).toEqual({
      outputPath: 'dist/apps/my-app',
      optimization: true,
      sourceMap: false,
    });
  });

  it('should expand dependsOn ^build to flat taskId list', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              dependsOn: ['^build'],
            },
          },
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: { executor: '@nx/js:tsc' },
          },
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'libs/lib-b',
          name: 'lib-b',
          targets: {
            build: { executor: '@nx/js:tsc' },
          },
        },
        'lib'
      )
      .addDependency('my-app', 'lib-a')
      .addDependency('my-app', 'lib-b')
      .build();

    await showTargetInfoHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.dependsOn).toBeDefined();
    expect(parsed.dependsOn.sort()).toEqual(['lib-a:build', 'lib-b:build']);
  });

  it('should expand self-reference dependsOn to same project taskId', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: { executor: '@nx/web:build' },
            test: {
              executor: '@nx/jest:jest',
              dependsOn: ['build'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetInfoHandler({
      target: 'my-app:test',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.dependsOn).toBeDefined();
    expect(parsed.dependsOn).toContain('my-app:build');
  });

  it('should error when target not found and list available targets', async () => {
    const { output } = require('../../utils/output');
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: { executor: '@nx/web:build' },
            test: { executor: '@nx/jest:jest' },
          },
        },
        'app'
      )
      .build();

    await expect(
      showTargetInfoHandler({
        target: 'my-app:serve',
        json: true,
      })
    ).rejects.toThrow('process.exit: 1');

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('serve'),
        bodyLines: expect.arrayContaining([expect.stringContaining('build')]),
      })
    );
  });

  it('should error when project not found', async () => {
    const { output } = require('../../utils/output');
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: { build: { executor: '@nx/web:build' } },
        },
        'app'
      )
      .build();

    await expect(
      showTargetInfoHandler({
        target: 'nonexistent:build',
        json: true,
      })
    ).rejects.toThrow('process.exit: 1');

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('nonexistent'),
      })
    );
  });

  it('should error when configuration not found and list available configs', async () => {
    const { output } = require('../../utils/output');
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              configurations: {
                production: {},
                staging: {},
              },
            },
          },
        },
        'app'
      )
      .build();

    await expect(
      showTargetInfoHandler({
        target: 'my-app:build',
        configuration: 'nonexistent',
        json: true,
      })
    ).rejects.toThrow('process.exit: 1');

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('nonexistent'),
        bodyLines: expect.arrayContaining([
          expect.stringContaining('production'),
        ]),
      })
    );
  });

  it('should resolve output interpolation with {projectRoot}', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              options: { outputPath: 'dist/apps/my-app' },
              outputs: ['{projectRoot}/dist', '{options.outputPath}'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('apps/my-app/dist');
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
  });

  it('should list resolved input files via HashPlanInspector', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: ['NX_CLOUD_ENCRYPTION_KEY'],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
    expect(parsed.files).toContain('apps/my-app/src/app.ts');
    expect(parsed.environment).toContain('NX_CLOUD_ENCRYPTION_KEY');
  });

  it('should resolve input files when target has defaultConfiguration', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
              configurations: {
                local: {},
                production: {},
              },
              defaultConfiguration: 'local',
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build:local': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
    expect(parsed.files).toContain('apps/my-app/src/app.ts');
  });

  it('should prefer explicit configuration over defaultConfiguration', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
              configurations: {
                local: {},
                production: {},
              },
              defaultConfiguration: 'local',
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build:production': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      configuration: 'production',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
  });

  it('should throw when task is not found in hash plan', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
            },
          },
        },
        'app'
      )
      .build();

    // Plan does not contain the expected task
    mockHashInputs = {};

    await expect(
      showTargetInputsHandler({
        target: 'my-app:build',
        json: true,
      })
    ).rejects.toThrow('Could not find hash plan for task "my-app:build"');
  });

  it('should identify matching file with --check', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/src/main.ts'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('apps/my-app/src/main.ts');
    expect(logged).toContain('is an input');
    expect(process.exitCode).toBe(0);
  });

  it('should identify matching environment variable with --check', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: ['CI', 'NX_CLOUD_ENCRYPTION_KEY'],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['CI'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('CI');
    expect(logged).toContain('is an input');
    expect(logged).toContain('environment');
    expect(process.exitCode).toBe(0);
  });

  it('should report non-match correctly with --check for inputs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/README.md'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('apps/my-app/README.md');
    expect(logged).toContain('not');
    expect(process.exitCode).toBe(1);
  });

  it('should normalize leading ./ in --check paths', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['./apps/my-app/src/main.ts'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('is an input');
    expect(process.exitCode).toBe(0);
  });

  it('should report directory containing input files with --check', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['./apps/my-app/src'],
    });

    const calls = (console.log as jest.Mock).mock.calls.map((c) => c[0]);
    const allLogged = calls.join('\n');
    expect(allLogged).toContain('directory containing');
    expect(allLogged).toContain('2');
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('apps/my-app/src/app.ts');
    expect(process.exitCode).toBe(0);
  });

  it('should list resolved output paths', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              options: { outputPath: 'dist/apps/my-app' },
              outputs: ['{options.outputPath}'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
  });

  it('should identify matching file with --check for outputs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{projectRoot}/dist'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/main.js'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('apps/my-app/dist/main.js');
    expect(logged).toContain('is an output');
    expect(process.exitCode).toBe(0);
  });

  it('should detect directory containing output paths with --check for outputs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{projectRoot}/dist', '{projectRoot}/coverage'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app'],
    });

    const calls = (console.log as jest.Mock).mock.calls.map((c) => c[0]);
    const allLogged = calls.join('\n');
    expect(allLogged).toContain('directory containing');
    expect(allLogged).toContain('2');
    expect(process.exitCode).toBe(0);
  });

  it('should match file via expanded outputs when configured paths use globs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{projectRoot}/dist/*.js'],
            },
          },
        },
        'app'
      )
      .build();

    // Simulate native expandOutputs resolving glob to actual files
    mockExpandedOutputs = [
      'apps/my-app/dist/main.js',
      'apps/my-app/dist/vendor.js',
    ];

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/main.js'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('apps/my-app/dist/main.js');
    expect(logged).toContain('is an output');
    expect(process.exitCode).toBe(0);
  });

  it('should not flag {options.*} outputs as unresolved when option is set', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              options: { outputPath: 'dist/apps/my-app' },
              outputs: ['{options.outputPath}'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
    expect(parsed.unresolvedOutputs).toBeUndefined();
  });

  it('should flag {options.*} outputs as unresolved when option is not set', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{projectRoot}/dist', '{options.outputFile}'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('apps/my-app/dist');
    expect(parsed.outputPaths).not.toContain('{options.outputFile}');
    expect(parsed.unresolvedOutputs).toContain('{options.outputFile}');
  });

  it('should resolve {options.*} from configuration when provided', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{options.outputFile}'],
              configurations: {
                production: { outputFile: 'dist/apps/my-app/main.js' },
              },
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      configuration: 'production',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('dist/apps/my-app/main.js');
    expect(parsed.unresolvedOutputs).toBeUndefined();
  });

  it('should report no match for directory without outputs via --check for outputs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{projectRoot}/dist'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['libs/other'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('libs/other');
    expect(logged).toContain('not');
    expect(process.exitCode).toBe(1);
  });

  it('should render grouped output when checking multiple input paths', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: ['CI'],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/src/main.ts', 'CI', 'apps/my-app/README.md'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    // Matched items grouped together
    expect(allLogged).toContain('were inputs');
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('CI');
    // Unmatched items grouped together
    expect(allLogged).toContain('not');
    expect(allLogged).toContain('apps/my-app/README.md');
    // exitCode should be 1 because at least one path didn't match
    expect(process.exitCode).toBe(1);
  });

  it('should render grouped output when checking multiple output paths', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              outputs: ['{projectRoot}/dist'],
            },
          },
        },
        'app'
      )
      .build();

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/main.js', 'libs/other/file.js'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    // Matched items grouped together
    expect(allLogged).toContain('were outputs');
    expect(allLogged).toContain('apps/my-app/dist/main.js');
    // Unmatched items grouped together
    expect(allLogged).toContain('not');
    expect(allLogged).toContain('libs/other/file.js');
    // exitCode should be 1 because at least one path didn't match
    expect(process.exitCode).toBe(1);
  });

  it('should set exitCode 0 when all multiple check values match', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('were inputs');
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('apps/my-app/src/app.ts');
    expect(allLogged).not.toContain('not');
    expect(process.exitCode).toBe(0);
  });

  it('should deduplicate folder entries when child files are also in check list', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: {
              executor: '@nx/web:build',
              inputs: ['{projectRoot}/**/*.ts'],
            },
          },
        },
        'app'
      )
      .build();

    mockHashInputs = {
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    };

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: [
        'apps/my-app/src',
        'apps/my-app/src/main.ts',
        'apps/my-app/src/app.ts',
      ],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    // The folder should have been removed since its children are present
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('apps/my-app/src/app.ts');
    // Should not contain 'directory containing' since the folder was deduplicated
    expect(allLogged).not.toContain('directory containing');
    expect(process.exitCode).toBe(0);
  });
});

class GraphBuilder {
  nodes: Record<string, ProjectGraphProjectNode> = {};
  dependencies: Record<
    string,
    { type: string; source: string; target: string }[]
  > = {};

  addProjectConfiguration(
    project: ProjectConfiguration & { name: string },
    type: ProjectGraph['nodes'][string]['type']
  ) {
    this.nodes[project.name] = {
      name: project.name,
      type,
      data: { ...project },
    };
    if (!this.dependencies[project.name]) {
      this.dependencies[project.name] = [];
    }
    return this;
  }

  addDependency(source: string, target: string) {
    if (!this.dependencies[source]) {
      this.dependencies[source] = [];
    }
    this.dependencies[source].push({
      type: 'static',
      source,
      target,
    });
    return this;
  }

  build(): ProjectGraph {
    return {
      nodes: this.nodes,
      dependencies: this.dependencies,
      externalNodes: {},
    };
  }
}
