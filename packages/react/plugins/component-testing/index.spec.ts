import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { pathToFileURL } from 'url';
import { type ExecutorContext, type Target, workspaceRoot } from '@nx/devkit';
import { nxComponentTestingPreset } from './index';

const state = vi.hoisted(() => ({ graph: undefined as any }));
vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  readCachedProjectGraph: () => state.graph,
  readTargetOptions: (target: Target, context: ExecutorContext) => ({
    ...context.projectGraph.nodes[target.project].data.targets[target.target]
      .options,
    ...context.projectGraph.nodes[target.project].data.targets[target.target]
      .configurations?.[target.configuration],
  }),
}));

function webpackConfig(path: string) {
  const { devServer } = nxComponentTestingPreset(path);
  if (devServer.bundler !== 'webpack') throw new Error('Expected webpack');
  return devServer.webpackConfig;
}

describe('React Cypress webpack configuration', () => {
  let directory: string;
  let configPath: string;
  const originalBuildTarget = process.env.NX_BUILD_TARGET;
  const originalComponentTest = process.env.NX_CYPRESS_COMPONENT_TEST;

  beforeEach(() => {
    mkdirSync(join(workspaceRoot, 'tmp'), { recursive: true });
    directory = mkdtempSync(join(workspaceRoot, 'tmp/react-ct-'));
    configPath = join(directory, 'cypress.config.ts');
    writeFileSync(configPath, 'export default {};');
    writeFileSync(
      join(directory, 'tsconfig.cy.json'),
      JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@fixture/*': ['./src/*'] } },
      })
    );
    const root = relative(workspaceRoot, directory);
    state.graph = {
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: {
            name: 'app',
            root,
            sourceRoot: `${root}/src`,
            targets: {
              build: {
                executor: '@nx/webpack:webpack',
                options: {
                  main: `${root}/src/main.tsx`,
                  tsConfig: `${root}/tsconfig.cy.json`,
                  webpackConfig: `${root}/webpack.config.cjs`,
                },
                configurations: { test: { sourceMap: false } },
              },
              'component-test': {
                executor: '@nx/cypress:cypress',
                options: {
                  devServerTarget: 'app:build:test',
                },
              },
            },
          },
        },
      },
      dependencies: { app: [] },
    };
    process.env.NX_BUILD_TARGET = 'previous:build';
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    if (originalBuildTarget === undefined) delete process.env.NX_BUILD_TARGET;
    else process.env.NX_BUILD_TARGET = originalBuildTarget;
    if (originalComponentTest === undefined)
      delete process.env.NX_CYPRESS_COMPONENT_TEST;
    else process.env.NX_CYPRESS_COMPONENT_TEST = originalComponentTest;
  });

  it.each(['directory', 'filename', 'file URL'])(
    'resolves fallback tsconfig from the project %s',
    (kind) => {
      delete state.graph.nodes.app.data.targets.build.options.webpackConfig;
      const input =
        kind === 'directory'
          ? directory
          : kind === 'filename'
            ? configPath
            : pathToFileURL(configPath).href;
      const config = webpackConfig(input);
      expect(config.resolve.plugins[0].absoluteBaseUrl).toBe(directory);
      expect(config.module.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ loader: require.resolve('babel-loader') }),
        ])
      );
    }
  );

  it('scopes the build target and options across await without changing global state', async () => {
    writeFileSync(
      join(directory, 'webpack.config.cjs'),
      `
      const { webpackExecutorContext } = require('@nx/webpack/internal');
      const initialTarget = process.env.NX_BUILD_TARGET;
      const initialContext = webpackExecutorContext.getStore();
      module.exports = async () => {
        await Promise.resolve();
        return { name: initialTarget, initialContext,
          scopedContext: webpackExecutorContext.getStore(),
          targetAfterAwait: process.env.NX_BUILD_TARGET, plugins: [] };
      };
    `
    );
    const config = await webpackConfig(configPath)();
    expect(config.name).toBe('previous:build');
    expect(config.targetAfterAwait).toBe('previous:build');
    expect(config.initialContext).toBe(config.scopedContext);
    expect(config.scopedContext.target).toEqual({
      project: 'app',
      target: 'build',
      configuration: 'test',
    });
    expect(config.scopedContext.options).toMatchObject({
      main: `${relative(workspaceRoot, directory)}/src/main.tsx`,
      sourceMap: false,
      generateIndexHtml: false,
      extractLicenses: false,
    });
    expect(process.env.NX_BUILD_TARGET).toBe('previous:build');
    expect(
      require('@nx/webpack/internal').webpackExecutorContext.getStore()
    ).toBeUndefined();
  });

  it('clears scoped context after a config factory rejects without changing global state', async () => {
    writeFileSync(
      join(directory, 'webpack.config.cjs'),
      `
      module.exports = async () => { throw new Error('invalid webpack config'); };
    `
    );
    await expect(webpackConfig(configPath)()).rejects.toThrow(
      'invalid webpack config'
    );
    expect(process.env.NX_BUILD_TARGET).toBe('previous:build');
    expect(
      require('@nx/webpack/internal').webpackExecutorContext.getStore()
    ).toBeUndefined();
  });
});
