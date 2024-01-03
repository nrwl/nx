import * as devkit from '@nx/devkit';
import { ProjectGraph, readJson, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import remote from './remote';
import { getRootTsConfigPathInTree } from '@nx/js';

jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    readCachedProjectGraph: jest.fn().mockImplementation(
      (): ProjectGraph => ({
        dependencies: {},
        nodes: {
          test: {
            name: 'test',
            type: 'app',
            data: {
              root: 'test',
              sourceRoot: 'test/src',
              targets: {
                build: {
                  executor: '@nx/webpack:webpack',
                  outputs: ['{options.outputPath}'],
                  defaultConfiguration: 'production',
                  options: {
                    compiler: 'babel',
                    outputPath: 'dist/test',
                    index: 'test/src/index.html',
                    baseHref: '/',
                    main: `test/src/main.tsx`,
                    tsConfig: 'test/tsconfig.app.json',
                    assets: ['test/src/favicon.ico', 'src/assets'],
                    styles: [`test/src/styles.css`],
                    scripts: [],
                    webpackConfig: 'test/webpack.config.js',
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
                          replace: `test/src/environments/environment.ts`,
                          with: `test/src/environments/environment.prod.ts`,
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
                    buildTarget: `test:build`,
                    hmr: true,
                  },
                  configurations: {
                    development: {
                      buildTarget: `test:build:development`,
                    },
                    production: {
                      buildTarget: `test:build:production`,
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

describe('remote generator', () => {
  // TODO(@jaysoo): Turn this back to adding the plugin
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });

  it('should create the remote with the correct config files', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'jest',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
    });

    expect(tree.exists('test/webpack.config.js')).toBeTruthy();
    expect(tree.exists('test/webpack.config.prod.js')).toBeTruthy();
    expect(tree.exists('test/module-federation.config.js')).toBeTruthy();

    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.prod.js', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.config.js', 'utf-8')
    ).toMatchSnapshot();

    const tsconfigJson = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsconfigJson.compilerOptions.paths['test/Module']).toEqual([
      'test/src/remote-entry.ts',
    ]);
  });

  it('should create the remote with the correct config files when --js=true', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'jest',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
      js: true,
    });

    expect(tree.exists('test/webpack.config.js')).toBeTruthy();
    expect(tree.exists('test/webpack.config.prod.js')).toBeTruthy();
    expect(tree.exists('test/module-federation.config.js')).toBeTruthy();

    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.prod.js', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.config.js', 'utf-8')
    ).toMatchSnapshot();

    const tsconfigJson = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsconfigJson.compilerOptions.paths['test/Module']).toEqual([
      'test/src/remote-entry.js',
    ]);
  });

  it('should create the remote with the correct config files when --typescriptConfiguration=true', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: false,
      style: 'css',
      unitTestRunner: 'jest',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: true,
    });

    expect(tree.exists('test/webpack.config.ts')).toBeTruthy();
    expect(tree.exists('test/webpack.config.prod.ts')).toBeTruthy();
    expect(tree.exists('test/module-federation.config.ts')).toBeTruthy();

    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.prod.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should install @nx/web for the file-server executor', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'jest',
      projectNameAndRootFormat: 'as-provided',
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/web']).toBeDefined();
  });

  it('should not set the remote as the default project', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'jest',
      projectNameAndRootFormat: 'as-provided',
    });

    const { defaultProject } = readNxJson(tree);
    expect(defaultProject).toBeUndefined();
  });

  it('should generate a remote-specific server.ts file for --ssr', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'jest',
      ssr: true,
      projectNameAndRootFormat: 'as-provided',
    });

    const mainFile = tree.read('test/server.ts', 'utf-8');
    expect(mainFile).toContain(`join(process.cwd(), 'dist/test/browser')`);
    expect(mainFile).toContain('nx.server.ready');
  });

  it('should generate correct remote with config files when using --ssr', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: true,
      style: 'css',
      unitTestRunner: 'jest',
      ssr: true,
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
    });

    expect(tree.exists('test/webpack.server.config.js')).toBeTruthy();
    expect(tree.exists('test/module-federation.server.config.js')).toBeTruthy();

    expect(
      tree.read('test/webpack.server.config.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.server.config.js', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate correct remote with config files when using --ssr and --typescriptConfiguration=true', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await remote(tree, {
      name: 'test',
      devServerPort: 4201,
      e2eTestRunner: 'cypress',
      linter: Linter.EsLint,
      skipFormat: false,
      style: 'css',
      unitTestRunner: 'jest',
      ssr: true,
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: true,
    });

    expect(tree.exists('test/webpack.server.config.ts')).toBeTruthy();
    expect(tree.exists('test/module-federation.server.config.ts')).toBeTruthy();

    expect(
      tree.read('test/webpack.server.config.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.server.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });
});
