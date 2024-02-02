import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  joinPathFragments,
  ProjectGraph,
  readCachedProjectGraph,
  readJson,
  Tree,
} from '@nx/devkit';
import applicationGenerator from '../application/application';
import setupSsrGenerator from './setup-ssr';
import { Linter } from '@nx/eslint';

jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    readCachedProjectGraph: jest.fn().mockImplementation(
      (): ProjectGraph => ({
        dependencies: {},
        nodes: {
          'my-app': {
            name: 'my-app',
            type: 'app',
            data: {
              root: 'my-app',
              sourceRoot: 'my-app/src',
              targets: {
                build: {
                  executor: '@nx/webpack:webpack',
                  outputs: ['{options.outputPath}'],
                  defaultConfiguration: 'production',
                  options: {
                    compiler: 'babel',
                    outputPath: 'dist/app/my-app',
                    index: 'my-app/src/index.html',
                    baseHref: '/',
                    main: `my-app/src/main.tsx`,
                    tsConfig: 'my-app/tsconfig.app.json',
                    assets: ['my-app/src/favicon.ico', 'src/assets'],
                    styles: [`my-app/src/styles.css`],
                    scripts: [],
                    webpackConfig: 'my-app/webpack.config.js',
                  },
                  configurations: {
                    development: {
                      extractLicenses: false,
                      optimization: false,
                      sourceMap: true,
                      vendorChunk: true,
                    },
                    production: {
                      fileReplacements: [
                        {
                          replace: `my-app/src/environments/environment.ts`,
                          with: `my-app/src/environments/environment.prod.ts`,
                        },
                      ],
                      optimization: true,
                      outputHashing: 'all',
                      sourceMap: false,
                      namedChunks: false,
                      extractLicenses: true,
                      vendorChunk: false,
                    },
                  },
                },
                serve: {
                  executor: '@nx/webpack:dev-server',
                  defaultConfiguration: 'development',
                  options: {
                    buildTarget: `my-app:build`,
                    hmr: true,
                  },
                  configurations: {
                    development: {
                      buildTarget: `my-app:build:development`,
                    },
                    production: {
                      buildTarget: `my-app:build:production`,
                      hmr: false,
                    },
                  },
                },
              },
            },
          },
        },
      })
    ),
  };
});

describe('setupSsrGenerator', () => {
  let tree: Tree;

  // TODO(@jaysoo): Turn this back to adding the plugin
  let originalEnv: string;
  let appName = 'my-app';

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    jest.clearAllMocks();
  });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    applicationGenerator(tree, {
      name: appName,
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });
  });

  it('should add SSR files', async () => {
    await setupSsrGenerator(tree, {
      project: appName,
    });

    expect(tree.exists(`${appName}/server.ts`)).toBeTruthy();
    expect(tree.exists(`${appName}/tsconfig.server.json`)).toBeTruthy();
  });

  it('should support adding additional include files', async () => {
    await setupSsrGenerator(tree, {
      project: appName,
      extraInclude: ['src/remote.d.ts'],
    });

    expect(tree.exists(`${appName}/server.ts`)).toBeTruthy();
    expect(readJson(tree, `${appName}/tsconfig.server.json`)).toMatchObject({
      include: ['src/remote.d.ts', 'src/main.server.tsx', 'server.ts'],
    });
  });
});
