import {
  GraphBuilder,
  setupBeforeEach,
  setupAfterEach,
  setGraph,
  setMockSourceMaps,
  setMockHasCustomHasher,
} from './test-utils';
import { showTargetInfoHandler } from './info';

describe('show target info', () => {
  beforeEach(setupBeforeEach);
  afterEach(setupAfterEach);

  it('should show target info when project:target is provided', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.project).toBe('my-app');
    expect(parsed.target).toBe('build');
    expect(parsed.executor).toBe('@nx/web:build');
    expect(parsed.options).toEqual({ outputPath: 'dist/apps/my-app' });
  });

  it('should infer project from cwd when only target name given', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: { build: { executor: '@nx/web:build' } },
          },
          'app'
        )
        .build()
    );

    process.cwd = jest.fn().mockReturnValue('/workspace/apps/my-app');

    await showTargetInfoHandler({ target: 'build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.project).toBe('my-app');
    expect(parsed.target).toBe('build');
  });

  it('should output valid JSON with expected structure', async () => {
    setGraph(
      new GraphBuilder()
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
                configurations: { production: { optimization: true } },
                defaultConfiguration: 'production',
              },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
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
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                options: {
                  outputPath: 'dist/apps/my-app',
                  optimization: false,
                },
                configurations: {
                  production: { optimization: true, sourceMap: false },
                },
              },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetInfoHandler({
      target: 'my-app:build',
      configuration: 'production',
      json: true,
    });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.options).toEqual({
      outputPath: 'dist/apps/my-app',
      optimization: true,
      sourceMap: false,
    });
  });

  it('should expand dependsOn ^build to flat taskId list', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: { executor: '@nx/web:build', dependsOn: ['^build'] },
            },
          },
          'app'
        )
        .addProjectConfiguration(
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: { build: { executor: '@nx/js:tsc' } },
          },
          'lib'
        )
        .addProjectConfiguration(
          {
            root: 'libs/lib-b',
            name: 'lib-b',
            targets: { build: { executor: '@nx/js:tsc' } },
          },
          'lib'
        )
        .addDependency('my-app', 'lib-a')
        .addDependency('my-app', 'lib-b')
        .build()
    );

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.dependsOn.sort()).toEqual(['lib-a:build', 'lib-b:build']);
  });

  it('should expand self-reference dependsOn to same project taskId', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: { executor: '@nx/web:build' },
              test: { executor: '@nx/jest:jest', dependsOn: ['build'] },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetInfoHandler({ target: 'my-app:test', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.dependsOn).toContain('my-app:build');
  });

  it('should error when target not found and list available targets', async () => {
    const { output } = require('../../../utils/output');
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await expect(
      showTargetInfoHandler({ target: 'my-app:serve', json: true })
    ).rejects.toThrow('process.exit: 1');

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('serve'),
        bodyLines: expect.arrayContaining([expect.stringContaining('build')]),
      })
    );
  });

  it('should error when project not found', async () => {
    const { output } = require('../../../utils/output');
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: { build: { executor: '@nx/web:build' } },
          },
          'app'
        )
        .build()
    );

    await expect(
      showTargetInfoHandler({ target: 'nonexistent:build', json: true })
    ).rejects.toThrow('process.exit: 1');

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('nonexistent'),
      })
    );
  });

  it('should error when configuration not found and list available configs', async () => {
    const { output } = require('../../../utils/output');
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                configurations: { production: {}, staging: {} },
              },
            },
          },
          'app'
        )
        .build()
    );

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

  it('should not duplicate inputs when multiple scoped input references expand to the same named input', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                inputs: [
                  { input: 'production', projects: ['tag:npm:public'] },
                  { input: 'production', projects: ['tag:maven:dev'] },
                  '{workspaceRoot}/scripts/**/*',
                ],
              },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    // Scoped inputs should be preserved as objects, not expanded
    expect(parsed.inputs).toEqual([
      { input: 'production', projects: ['tag:npm:public'] },
      { input: 'production', projects: ['tag:maven:dev'] },
      '{workspaceRoot}/scripts/**/*',
    ]);
  });

  it('should indicate custom hasher in JSON output', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: { build: { executor: '@nx/web:build' } },
          },
          'app'
        )
        .build()
    );

    setMockHasCustomHasher(true);

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.customHasher).toBe(true);
  });

  it('should indicate custom hasher in text output', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: { build: { executor: '@nx/web:build' } },
          },
          'app'
        )
        .build()
    );

    setMockHasCustomHasher(true);

    await showTargetInfoHandler({ target: 'my-app:build', json: false });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('custom');
    expect(allLogged).toContain('inputs do not affect');
  });

  it('should include sourceMap in JSON output when source maps are available', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                options: { outputPath: 'dist/apps/my-app' },
                cache: true,
              },
            },
          },
          'app'
        )
        .build()
    );

    setMockSourceMaps({
      'apps/my-app': {
        'targets.build': ['apps/my-app/project.json', '@nx/web'],
        'targets.build.executor': ['apps/my-app/project.json', '@nx/web'],
        'targets.build.options.outputPath': [
          'apps/my-app/project.json',
          '@nx/web',
        ],
        'targets.build.cache': ['nx.json', 'nx/core/project-json'],
      },
    });

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.sourceMap).toBeDefined();
    expect(parsed.sourceMap.executor).toEqual([
      'apps/my-app/project.json',
      '@nx/web',
    ]);
    expect(parsed.sourceMap['options.outputPath']).toEqual([
      'apps/my-app/project.json',
      '@nx/web',
    ]);
    expect(parsed.sourceMap.cache).toEqual(['nx.json', 'nx/core/project-json']);
    expect(parsed.sourceMap.target).toEqual([
      'apps/my-app/project.json',
      '@nx/web',
    ]);
  });

  it('should not include sourceMap when source maps are empty', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: { build: { executor: '@nx/web:build' } },
          },
          'app'
        )
        .build()
    );

    setMockSourceMaps({});

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.sourceMap).toBeUndefined();
  });

  it('should show source annotations in text output', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockSourceMaps({
      'apps/my-app': {
        'targets.build': ['apps/my-app/project.json', '@nx/web'],
        'targets.build.executor': ['apps/my-app/project.json', '@nx/web'],
        'targets.build.options.outputPath': [
          'apps/my-app/project.json',
          '@nx/web',
        ],
      },
    });

    await showTargetInfoHandler({
      target: 'my-app:build',
      json: false,
      verbose: true,
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('apps/my-app/project.json');
    expect(allLogged).toContain('@nx/web');
  });

  it('should only include source map entries for the requested target', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockSourceMaps({
      'apps/my-app': {
        'targets.build': ['apps/my-app/project.json', '@nx/web'],
        'targets.build.executor': ['apps/my-app/project.json', '@nx/web'],
        'targets.test': ['apps/my-app/project.json', '@nx/jest'],
        'targets.test.executor': ['apps/my-app/project.json', '@nx/jest'],
      },
    });

    await showTargetInfoHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.sourceMap).toBeDefined();
    expect(parsed.sourceMap.executor).toEqual([
      'apps/my-app/project.json',
      '@nx/web',
    ]);
    expect(parsed.sourceMap['targets.test']).toBeUndefined();
    expect(parsed.sourceMap['targets.test.executor']).toBeUndefined();
  });

  it('should show per-item source hints for inputs, outputs, and dependsOn with --verbose', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                inputs: ['default'],
                outputs: ['{projectRoot}/dist'],
                dependsOn: ['prebuild'],
              },
              prebuild: { executor: '@nx/web:build' },
            },
          },
          'app'
        )
        .build()
    );

    // Use container-level source map keys (matching real-world source maps)
    // Per-index keys (inputs.0, outputs.0) may or may not exist; the code
    // falls back to the container key when the per-index key is missing.
    setMockSourceMaps({
      'apps/my-app': {
        'targets.build': ['project.json', '@nx/web'],
        'targets.build.executor': ['project.json', '@nx/web'],
        'targets.build.inputs': ['nx.json', 'nx/target-defaults'],
        'targets.build.outputs': ['project.json', '@nx/web'],
        'targets.build.dependsOn': ['project.json', '@nx/web'],
      },
    });

    await showTargetInfoHandler({
      target: 'my-app:build',
      json: false,
      verbose: true,
    });

    const lines = (console.log as jest.Mock).mock.calls.map((c) =>
      String(c[0])
    );

    // Find the specific lines for dependsOn, input, and output items
    const depLine = lines.find((l) => l.includes('prebuild'));
    const outputLine = lines.find((l) => l.includes('dist'));
    const inputLine = lines.find(
      (l) => l.includes('fileset') || l.includes('default')
    );

    // Each per-item line should contain source info when verbose
    // (falls back to container key when per-index key is missing)
    expect(depLine).toBeDefined();
    expect(depLine).toContain('project.json');
    expect(outputLine).toBeDefined();
    expect(outputLine).toContain('project.json');
    expect(inputLine).toBeDefined();
    expect(inputLine).toContain('nx.json');

    // Also verify JSON output strips internal fields
    jest.clearAllMocks();
    await showTargetInfoHandler({
      target: 'my-app:build',
      json: true,
    });
    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed._depSources).toBeUndefined();
    expect(parsed._inputSources).toBeUndefined();
  });

  it('should not show any source hints without --verbose', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                inputs: ['default'],
                outputs: ['{projectRoot}/dist'],
                dependsOn: ['prebuild'],
              },
              prebuild: { executor: '@nx/web:build' },
            },
          },
          'app'
        )
        .build()
    );

    setMockSourceMaps({
      'apps/my-app': {
        'targets.build': ['project.json', '@nx/web'],
        'targets.build.executor': ['project.json', '@nx/web'],
        'targets.build.inputs': ['nx.json', 'nx/target-defaults'],
        'targets.build.outputs': ['project.json', '@nx/web'],
        'targets.build.dependsOn': ['project.json', '@nx/web'],
      },
    });

    await showTargetInfoHandler({
      target: 'my-app:build',
      json: false,
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    // No source hints (the "(from ...)" annotations) should appear
    expect(allLogged).not.toContain('(from');
    expect(allLogged).not.toContain('(by');
  });
});
