import * as devkit from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { ProjectGraph, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import hostGenerator from './host';
import { Linter } from '@nx/eslint';

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

describe('hostGenerator', () => {
  let tree: Tree;

  // TODO(@jaysoo): Turn this back to adding the plugin
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
  });

  afterEach(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
  });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate host files and configs when --js=true', async () => {
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
      skipFormat: true,
      js: true,
    });

    expect(tree.exists('test/tsconfig.json')).toBeTruthy();

    expect(tree.exists('test/src/bootstrap.js')).toBeTruthy();
    expect(tree.exists('test/src/main.js')).toBeTruthy();
    expect(tree.exists('test/src/app/app.js')).toBeTruthy();
  });

  it('should generate host files and configs when --js=false', async () => {
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
    });

    expect(tree.exists('test/tsconfig.json')).toBeTruthy();

    expect(tree.exists('test/src/bootstrap.tsx')).toBeTruthy();
    expect(tree.exists('test/src/main.ts')).toBeTruthy();
    expect(tree.exists('test/src/app/app.tsx')).toBeTruthy();
  });

  it('should generate host files and configs when --typescriptConfiguration=true', async () => {
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: true,
      skipFormat: true,
    });

    expect(tree.exists('test/tsconfig.json')).toBeTruthy();

    expect(tree.exists('test/webpack.config.prod.ts')).toBeTruthy();

    expect(tree.exists('test/webpack.config.ts')).toBeTruthy();
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();

    expect(tree.exists('test/module-federation.config.ts')).toBeTruthy();
    expect(
      tree.read('test/module-federation.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate host files and configs when --typescriptConfiguration=false', async () => {
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
    });

    expect(tree.exists('test/tsconfig.json')).toBeTruthy();

    expect(tree.exists('test/webpack.config.prod.js')).toBeTruthy();

    expect(tree.exists('test/webpack.config.js')).toBeTruthy();
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();

    expect(tree.exists('test/module-federation.config.js')).toBeTruthy();
    expect(
      tree.read('test/module-federation.config.js', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should install @nx/web for the file-server executor', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await hostGenerator(tree, {
      name: 'test',
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/web']).toBeDefined();
  });

  it('should generate host files and configs for SSR', async () => {
    await hostGenerator(tree, {
      name: 'test',
      ssr: true,
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: false,
    });

    expect(tree.exists('test/tsconfig.json')).toBeTruthy();
    expect(tree.exists('test/webpack.config.prod.js')).toBeTruthy();
    expect(tree.exists('test/webpack.server.config.js')).toBeTruthy();
    expect(tree.exists('test/webpack.config.js')).toBeTruthy();
    expect(tree.exists('test/module-federation.config.js')).toBeTruthy();
    expect(tree.exists('test/module-federation.server.config.js')).toBeTruthy();
    expect(tree.exists('test/src/main.server.tsx')).toBeTruthy();
    expect(tree.exists('test/src/bootstrap.tsx')).toBeTruthy();
    expect(tree.exists('test/src/main.ts')).toBeTruthy();

    expect(readJson(tree, 'test/tsconfig.server.json')).toEqual({
      compilerOptions: {
        outDir: '../../out-tsc/server',
        target: 'es2019',
        types: [
          'node',
          '@nx/react/typings/cssmodule.d.ts',
          '@nx/react/typings/image.d.ts',
        ],
      },
      extends: './tsconfig.app.json',
      include: ['src/remotes.d.ts', 'src/main.server.tsx', 'server.ts'],
    });

    expect(
      tree.read('test/webpack.server.config.js', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.server.config.js', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate host files and configs for SSR when --typescriptConfiguration=true', async () => {
    await hostGenerator(tree, {
      name: 'test',
      ssr: true,
      style: 'css',
      linter: Linter.None,
      unitTestRunner: 'none',
      e2eTestRunner: 'none',
      projectNameAndRootFormat: 'as-provided',
      typescriptConfiguration: true,
    });

    expect(tree.exists('test/tsconfig.json')).toBeTruthy();
    expect(tree.exists('test/webpack.config.prod.ts')).toBeTruthy();
    expect(tree.exists('test/webpack.server.config.ts')).toBeTruthy();
    expect(tree.exists('test/webpack.config.ts')).toBeTruthy();
    expect(tree.exists('test/module-federation.config.ts')).toBeTruthy();
    expect(tree.exists('test/module-federation.server.config.ts')).toBeTruthy();
    expect(tree.exists('test/src/main.server.tsx')).toBeTruthy();
    expect(tree.exists('test/src/bootstrap.tsx')).toBeTruthy();
    expect(tree.exists('test/src/main.ts')).toBeTruthy();

    expect(readJson(tree, 'test/tsconfig.server.json')).toEqual({
      compilerOptions: {
        outDir: '../../out-tsc/server',
        target: 'es2019',
        types: [
          'node',
          '@nx/react/typings/cssmodule.d.ts',
          '@nx/react/typings/image.d.ts',
        ],
      },
      extends: './tsconfig.app.json',
      include: ['src/remotes.d.ts', 'src/main.server.tsx', 'server.ts'],
    });

    expect(
      tree.read('test/webpack.server.config.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/module-federation.server.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate a host and remotes in a directory correctly when using --projectNameAndRootFormat=as-provided', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await hostGenerator(tree, {
      name: 'host-app',
      directory: 'foo/host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      projectNameAndRootFormat: 'as-provided',
      e2eTestRunner: 'none',
      linter: Linter.None,
      style: 'css',
      unitTestRunner: 'none',
      typescriptConfiguration: false,
    });

    expect(tree.exists('foo/remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1', 'remote2', 'remote3'`);
  });

  it('should generate a host and remotes in a directory correctly when using --projectNameAndRootFormat=as-provided and --typescriptConfiguration=true', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await hostGenerator(tree, {
      name: 'host-app',
      directory: 'foo/host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      projectNameAndRootFormat: 'as-provided',
      e2eTestRunner: 'none',
      linter: Linter.None,
      style: 'css',
      unitTestRunner: 'none',
      typescriptConfiguration: true,
    });

    expect(tree.exists('foo/remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1', 'remote2', 'remote3'`);
  });
});
