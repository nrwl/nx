import {
  GraphBuilder,
  setupBeforeEach,
  setupAfterEach,
  setGraph,
  setMockHashInputs,
  setMockHasCustomHasher,
} from './test-utils';
import { showTargetInputsHandler } from './inputs';

describe('show target inputs', () => {
  beforeEach(setupBeforeEach);
  afterEach(setupAfterEach);

  it('should list resolved input files via HashPlanInspector', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: ['NX_CLOUD_ENCRYPTION_KEY'],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
    expect(parsed.files).toContain('apps/my-app/src/app.ts');
    expect(parsed.environment).toContain('NX_CLOUD_ENCRYPTION_KEY');
  });

  it('should resolve input files when target has defaultConfiguration', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                inputs: ['{projectRoot}/**/*.ts'],
                configurations: { local: {}, production: {} },
                defaultConfiguration: 'local',
              },
            },
          },
          'app'
        )
        .build()
    );

    setMockHashInputs({
      'my-app:build:local': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
    expect(parsed.files).toContain('apps/my-app/src/app.ts');
  });

  it('should prefer explicit configuration over defaultConfiguration', async () => {
    setGraph(
      new GraphBuilder()
        .addProjectConfiguration(
          {
            root: 'apps/my-app',
            name: 'my-app',
            targets: {
              build: {
                executor: '@nx/web:build',
                inputs: ['{projectRoot}/**/*.ts'],
                configurations: { local: {}, production: {} },
                defaultConfiguration: 'local',
              },
            },
          },
          'app'
        )
        .build()
    );

    setMockHashInputs({
      'my-app:build:production': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({
      target: 'my-app:build',
      configuration: 'production',
      json: true,
    });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.files).toContain('apps/my-app/src/main.ts');
  });

  it('should throw when task is not found in hash plan', async () => {
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

    setMockHashInputs({});

    await expect(
      showTargetInputsHandler({ target: 'my-app:build', json: true })
    ).rejects.toThrow('Could not find hash plan for task "my-app:build"');
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
                inputs: ['{projectRoot}/**/*.ts'],
              },
            },
          },
          'app'
        )
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

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
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: ['CI', 'NX_CLOUD_ENCRYPTION_KEY'],
        depOutputs: [],
        external: [],
      },
    });

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

  it('should report non-match correctly with --check', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

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
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['./apps/my-app/src/main.ts'],
    });

    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(logged).toContain('is an input');
    expect(process.exitCode).toBe(0);
  });

  it('should report directory containing input files with --check', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['./apps/my-app/src'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('directory containing');
    expect(allLogged).toContain('2');
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('apps/my-app/src/app.ts');
    expect(process.exitCode).toBe(0);
  });

  it('should render grouped output when checking multiple input paths', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: ['CI'],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/src/main.ts', 'CI', 'apps/my-app/README.md'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('were inputs');
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('CI');
    expect(allLogged).toContain('not');
    expect(allLogged).toContain('apps/my-app/README.md');
    expect(process.exitCode).toBe(1);
  });

  it('should set exitCode 0 when all multiple check values match', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('were inputs');
    expect(allLogged).not.toContain('not');
    expect(process.exitCode).toBe(0);
  });

  it('should deduplicate folder entries when child files are also in check list', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHashInputs({
      'my-app:build': {
        files: ['apps/my-app/src/main.ts', 'apps/my-app/src/app.ts'],
        runtime: [],
        environment: [],
        depOutputs: [],
        external: [],
      },
    });

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
    expect(allLogged).toContain('apps/my-app/src/main.ts');
    expect(allLogged).toContain('apps/my-app/src/app.ts');
    expect(allLogged).not.toContain('directory containing');
    expect(process.exitCode).toBe(0);
  });

  it('should warn and exit 1 when target uses a custom hasher', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHasCustomHasher(true);

    await showTargetInputsHandler({ target: 'my-app:build' });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('custom hasher');
    expect(allLogged).toContain('do not affect');
    expect(process.exitCode).toBe(1);
  });

  it('should warn and exit 1 for --check when target uses a custom hasher', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHasCustomHasher(true);

    await showTargetInputsHandler({
      target: 'my-app:build',
      check: ['apps/my-app/src/main.ts'],
    });

    const allLogged = (console.log as jest.Mock).mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(allLogged).toContain('custom hasher');
    expect(process.exitCode).toBe(1);
  });

  it('should output custom hasher warning as JSON when --json is used', async () => {
    setGraph(
      new GraphBuilder()
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
        .build()
    );

    setMockHasCustomHasher(true);

    await showTargetInputsHandler({ target: 'my-app:build', json: true });

    const parsed = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(parsed.warning).toContain('custom hasher');
    expect(process.exitCode).toBe(1);
  });
});
