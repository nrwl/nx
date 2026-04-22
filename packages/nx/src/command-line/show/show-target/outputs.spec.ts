import {
  GraphBuilder,
  setupBeforeEach,
  setupAfterEach,
  setGraph,
  setMockExpandedOutputs,
} from './test-utils';
import { showTargetOutputsHandler } from './outputs';

describe('show target outputs', () => {
  beforeEach(setupBeforeEach);
  afterEach(setupAfterEach);

  it('should resolve output interpolation with {projectRoot}', async () => {
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
                outputs: ['{projectRoot}/dist', '{options.outputPath}'],
              },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetOutputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.outputPaths).toContain('apps/my-app/dist');
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
  });

  it('should list resolved output paths', async () => {
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
              },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetOutputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
  });

  it('should identify matching file with --check', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/main.js'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('apps/my-app/dist/main.js');
    expect(logged).toContain('is an output');
    expect(process.exitCode).toBe(0);
  });

  it('should detect directory containing output paths with --check', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('directory containing');
    expect(allLogged).toContain('2');
    expect(process.exitCode).toBe(0);
  });

  it('should match file via expanded outputs when configured paths use globs', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockExpandedOutputs([
      'apps/my-app/dist/main.js',
      'apps/my-app/dist/vendor.js',
    ]);

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
              },
            },
          },
          'app'
        )
        .build()
    );

    await showTargetOutputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.outputPaths).toContain('dist/apps/my-app');
    expect(parsed.unresolvedOutputs).toBeUndefined();
  });

  it('should flag {options.*} outputs as unresolved when option is not set', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetOutputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.outputPaths).toContain('apps/my-app/dist');
    expect(parsed.outputPaths).not.toContain('{options.outputFile}');
    expect(parsed.unresolvedOutputs).toContain('{options.outputFile}');
  });

  it('should resolve {options.*} from configuration when provided', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetOutputsHandler({
      target: 'my-app:build',
      configuration: 'production',
      json: true,
    });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.outputPaths).toContain('dist/apps/my-app/main.js');
    expect(parsed.unresolvedOutputs).toBeUndefined();
  });

  it('should report no match for directory without outputs via --check', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['libs/other'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('libs/other');
    expect(logged).toContain('not');
    expect(process.exitCode).toBe(1);
  });

  it('should render grouped output when checking multiple output paths', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/main.js', 'libs/other/file.js'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('were outputs');
    expect(allLogged).toContain('apps/my-app/dist/main.js');
    expect(allLogged).toContain('not');
    expect(allLogged).toContain('libs/other/file.js');
    expect(process.exitCode).toBe(1);
  });
});
