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

  it('should match a file against a glob output pattern', async () => {
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

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/main.js'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('apps/my-app/dist/main.js');
    expect(logged).toContain('is an output');
    expect(process.exitCode).toBe(0);
  });

  it('should report expanded outputs contained under a checked directory', async () => {
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

    // No *resolved* pattern is prefixed by the checked directory, so the only
    // way `contained` can be populated is from the expanded outputs on disk.
    setMockExpandedOutputs([
      'apps/my-app/dist/nested/a.js',
      'apps/my-app/dist/nested/b.js',
    ]);

    await showTargetOutputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/dist/nested'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('directory containing');
    expect(allLogged).toContain('2');
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

  it('should resolve {options.*} from the defaultConfiguration when none is given', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                outputs: ['{options.outputPath}'],
                configurations: {
                  production: { outputPath: 'dist/apps/my-app' },
                },
                defaultConfiguration: 'production',
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
    // The output resolves under the default configuration, so it must not also
    // be reported as unresolved.
    expect(parsed.unresolvedOutputs).toBeUndefined();
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

  describe('project pattern specifiers', () => {
    function setSingleAppGraph() {
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
    }

    it('resolves a wildcard project name to the matching project', async () => {
      setSingleAppGraph();

      await showTargetOutputsHandler({ target: 'my-*:build', json: true });

      const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
      expect(parsed.project).toEqual('my-app');
      expect(parsed.outputPaths).toContain('dist/apps/my-app');
    });

    it('checks paths against a wildcard-resolved project', async () => {
      setSingleAppGraph();

      await showTargetOutputsHandler({
        target: 'my-*:build',
        check: ['dist/apps/my-app/main.js'],
      });

      const allLogged = (console.log as jest.Mock).mock.calls
        .map((c) => c[0])
        .join('\n');
      expect(allLogged).toContain('is an output of');
      expect(process.exitCode).toBe(0);
    });
  });
});
