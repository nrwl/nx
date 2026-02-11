import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { showTargetHandler } from './target';

let graph: ProjectGraph = {
  nodes: {},
  dependencies: {},
  externalNodes: {},
};

let mockCwd = '/workspace';
let mockNxJson: Record<string, unknown> = {};
let mockHashPlan: Record<string, string[]> = {};
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
    inspectTask: jest.fn().mockImplementation(() => mockHashPlan),
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
    mockHashPlan = {};
    mockExpandedOutputs = null;
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

    await showTargetHandler({
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

    await showTargetHandler({
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

    await showTargetHandler({
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
      inputs: ['default', '^default'],
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

    await showTargetHandler({
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

  it('should expand dependsOn ^build to dependency project:target pairs', async () => {
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

    await showTargetHandler({
      target: 'my-app:build',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.dependsOn).toBeDefined();
    expect(parsed.dependsOn.length).toBeGreaterThan(0);

    const buildDep = parsed.dependsOn.find(
      (d: { target: string }) => d.target === 'build'
    );
    expect(buildDep).toBeDefined();
    expect(buildDep.projects.sort()).toEqual(['lib-a', 'lib-b']);
  });

  it('should expand self-reference dependsOn to same project', async () => {
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

    await showTargetHandler({
      target: 'my-app:test',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.dependsOn).toBeDefined();
    const selfBuild = parsed.dependsOn.find(
      (d: { target: string }) => d.target === 'build'
    );
    expect(selfBuild).toBeDefined();
    expect(selfBuild.projects).toContain('my-app');
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
      showTargetHandler({
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
      showTargetHandler({
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
      showTargetHandler({
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

    await showTargetHandler({
      target: 'my-app:build',
      outputs: true,
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('apps/my-app/dist');
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
  });

  it('should list resolved input files with --inputs via HashPlanInspector', async () => {
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

    mockHashPlan = {
      'my-app:build': [
        'file:apps/my-app/src/main.ts',
        'file:apps/my-app/src/app.ts',
        'env:NX_CLOUD_ENCRYPTION_KEY',
        'my-app:ProjectConfiguration',
        'my-app:TsConfig',
      ],
    };

    await showTargetHandler({
      target: 'my-app:build',
      inputs: true,
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
    expect(parsed.files).toContain('apps/my-app/src/app.ts');
    expect(parsed.environmentVariables).toContain('NX_CLOUD_ENCRYPTION_KEY');
    // ProjectConfiguration and TsConfig are implicit — not in output
    expect(parsed.projectConfigurations).toBeUndefined();
  });

  it('should identify matching file with --check-input', async () => {
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

    mockHashPlan = {
      'my-app:build': ['file:apps/my-app/src/main.ts'],
    };

    await showTargetHandler({
      target: 'my-app:build',
      checkInput: 'apps/my-app/src/main.ts',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isInput).toBe(true);
  });

  it('should report non-match correctly with --check-input', async () => {
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

    mockHashPlan = {
      'my-app:build': ['file:apps/my-app/src/main.ts'],
    };

    await showTargetHandler({
      target: 'my-app:build',
      checkInput: 'apps/my-app/README.md',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isInput).toBe(false);
  });

  it('should normalize leading ./ in --check-input paths', async () => {
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

    mockHashPlan = {
      'my-app:build': ['file:apps/my-app/src/main.ts'],
    };

    await showTargetHandler({
      target: 'my-app:build',
      checkInput: './apps/my-app/src/main.ts',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isInput).toBe(true);
  });

  it('should report directory containing input files with --check-input', async () => {
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

    mockHashPlan = {
      'my-app:build': [
        'file:apps/my-app/src/main.ts',
        'file:apps/my-app/src/app.ts',
      ],
    };

    await showTargetHandler({
      target: 'my-app:build',
      checkInput: './apps/my-app/src',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isInput).toBe(false);
    expect(parsed.isDirectoryContainingInputs).toBe(true);
    expect(parsed.containedInputFiles).toContain('apps/my-app/src/main.ts');
    expect(parsed.containedInputFiles).toContain('apps/my-app/src/app.ts');
  });

  it('should list resolved output paths with --outputs', async () => {
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

    await showTargetHandler({
      target: 'my-app:build',
      outputs: true,
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
  });

  it('should identify matching file with --check-output', async () => {
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

    await showTargetHandler({
      target: 'my-app:build',
      checkOutput: 'apps/my-app/dist/main.js',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isOutput).toBe(true);
    expect(parsed.matchedOutput).toBe('apps/my-app/dist');
  });

  it('should detect directory containing output paths with --check-output', async () => {
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

    await showTargetHandler({
      target: 'my-app:build',
      checkOutput: 'apps/my-app',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isOutput).toBe(false);
    expect(parsed.isDirectoryContainingOutputs).toBe(true);
    expect(parsed.containedOutputPaths).toEqual(
      expect.arrayContaining(['apps/my-app/dist', 'apps/my-app/coverage'])
    );
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

    await showTargetHandler({
      target: 'my-app:build',
      checkOutput: 'apps/my-app/dist/main.js',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isOutput).toBe(true);
    expect(parsed.matchedOutput).toBe('apps/my-app/dist/main.js');
  });

  it('should report no match for directory without outputs via --check-output', async () => {
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

    await showTargetHandler({
      target: 'my-app:build',
      checkOutput: 'libs/other',
      json: true,
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.isOutput).toBe(false);
    expect(parsed.matchedOutput).toBeNull();
    expect(parsed.isDirectoryContainingOutputs).toBeUndefined();
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
