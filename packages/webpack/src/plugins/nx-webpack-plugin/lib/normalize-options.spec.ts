import { readCachedProjectGraph, workspaceRoot } from '@nx/devkit';
import { join } from 'path';
import { normalizeOptions, webpackExecutorContext } from './normalize-options';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  readCachedProjectGraph: vi.fn(() => ({
    nodes: {
      app: {
        data: {
          root: 'apps/app',
          targets: {
            build: {
              options: {
                main: 'apps/app/src/main.ts',
                outputHashing: 'all',
                extractCss: true,
              },
            },
          },
        },
      },
    },
  })),
}));

describe('native webpack plugin executor options', () => {
  beforeEach(() => {
    vi.stubEnv('NX_BUILD_TARGET', '');
    vi.stubEnv('NX_TASK_TARGET_PROJECT', 'app');
    vi.stubEnv('NX_TASK_TARGET_TARGET', 'build');
    vi.stubEnv('NX_TASK_TARGET_CONFIGURATION', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('honors effective CLI overrides over stored target and plugin options', () => {
    const result = webpackExecutorContext.run(
      {
        options: { outputHashing: 'none', extractCss: false },
        target: { project: 'app', target: 'build' },
      },
      () => normalizeOptions({ outputHashing: 'media', extractCss: true })
    );
    expect(result.outputHashing).toBe('none');
    expect(result.extractCss).toBe(false);
    expect(normalizeOptions({}).outputHashing).toBe('all');
    expect(normalizeOptions({}).extractCss).toBe(true);
  });

  it('preserves config-only options when the executor leaves them undefined', () => {
    const graph = readCachedProjectGraph();
    delete graph.nodes.app.data.targets.build.options.main;
    vi.mocked(readCachedProjectGraph).mockReturnValueOnce(graph);
    const result = webpackExecutorContext.run(
      {
        options: {
          main: undefined,
          tsConfig: undefined,
          outputFileName: undefined,
        },
        target: { project: 'app', target: 'build' },
      },
      () =>
        normalizeOptions({
          main: './src/config-entry.ts',
          tsConfig: './tsconfig.app.json',
          outputFileName: 'custom.js',
        })
    );
    expect(result.main).toBe('apps/app/src/config-entry.ts');
    expect(result.tsConfig).toBe('apps/app/tsconfig.app.json');
    expect(result.outputFileName).toBe('custom.js');
  });

  it('isolates overrides while configs load concurrently', async () => {
    const results = await Promise.all([
      webpackExecutorContext.run(
        {
          options: { outputHashing: 'none' },
          target: { project: 'app', target: 'build' },
        },
        async () => {
          await Promise.resolve();
          return normalizeOptions({}).outputHashing;
        }
      ),
      webpackExecutorContext.run(
        {
          options: { outputHashing: 'media' },
          target: { project: 'app', target: 'build' },
        },
        async () => {
          await Promise.resolve();
          return normalizeOptions({}).outputHashing;
        }
      ),
    ]);
    expect(results).toEqual(['none', 'media']);
    expect(webpackExecutorContext.getStore()).toBeUndefined();
  });

  it('isolates browser and server targets while their async configs load together', async () => {
    const graph = readCachedProjectGraph();
    graph.nodes.app.data.targets.server = {
      options: {
        main: 'apps/app/server.ts',
        target: 'node',
        generateIndexHtml: false,
      },
    };
    vi.mocked(readCachedProjectGraph)
      .mockReturnValueOnce(graph)
      .mockReturnValueOnce(graph);
    vi.stubEnv('NX_BUILD_TARGET', 'app:server');

    const [browser, server] = await Promise.all([
      webpackExecutorContext.run(
        {
          options: { main: 'apps/app/src/main.ts' },
          target: { project: 'app', target: 'build' },
        },
        async () => {
          await Promise.resolve();
          return normalizeOptions({});
        }
      ),
      webpackExecutorContext.run(
        {
          options: { main: 'apps/app/server.ts', target: 'node' },
          target: { project: 'app', target: 'server' },
        },
        async () => {
          await Promise.resolve();
          return normalizeOptions({});
        }
      ),
    ]);

    expect(browser.targetName).toBe('build');
    expect(browser.target).toBeUndefined();
    expect(browser.generateIndexHtml).toBe(true);
    expect(server.targetName).toBe('server');
    expect(server.target).toBe('node');
    expect(server.generateIndexHtml).toBe(false);
    expect(webpackExecutorContext.getStore()).toBeUndefined();
  });

  it('does not leak configuration overrides into the cached target options', () => {
    const graph = readCachedProjectGraph();
    graph.nodes.app.data.targets.build.configurations = {
      production: { sourceMap: false },
    };
    const originalOptions = { ...graph.nodes.app.data.targets.build.options };
    vi.mocked(readCachedProjectGraph)
      .mockReturnValueOnce(graph)
      .mockReturnValueOnce(graph);

    const production = webpackExecutorContext.run(
      {
        options: {},
        target: {
          project: 'app',
          target: 'build',
          configuration: 'production',
        },
      },
      () => normalizeOptions({ sourceMap: true })
    );
    const development = webpackExecutorContext.run(
      { options: {}, target: { project: 'app', target: 'build' } },
      () => normalizeOptions({ sourceMap: true })
    );

    expect(production.sourceMap).toBe(false);
    expect(development.sourceMap).toBe(true);
    expect(graph.nodes.app.data.targets.build.options).toEqual(originalOptions);
  });

  it('resolves executor asset inputs from the workspace and plugin inputs from the project', () => {
    const asset = {
      input: './apps/app/src/assets',
      glob: '**/*',
      output: 'assets',
    };
    const fromExecutor = webpackExecutorContext.run(
      {
        options: { assets: [asset] },
        target: { project: 'app', target: 'build' },
      },
      () => normalizeOptions({})
    );
    const fromPlugin = normalizeOptions({
      assets: [{ ...asset, input: './src/assets' }],
    });
    const expected = [
      { ...asset, input: join(workspaceRoot, 'apps/app/src/assets') },
    ];
    expect(fromExecutor.assets).toEqual(expected);
    expect(fromPlugin.assets).toEqual(expected);
  });
});
