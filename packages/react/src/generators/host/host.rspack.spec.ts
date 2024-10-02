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
                  executor: '@nx/rspack:rspack',
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
                    rspackConfig: 'test/rspack.config.js',
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
                  executor: '@nx/rspack:dev-server',
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

// TODO(colum): turn these on when rspack is moved into the main repo
xdescribe('hostGenerator', () => {
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

  describe('bundler=rspack', () => {
    it('should generate host files and configs when --js=true', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: false,
        skipFormat: true,
        js: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();

      expect(tree.exists('test/src/bootstrap.js')).toBeTruthy();
      expect(tree.exists('test/src/main.js')).toBeTruthy();
      expect(tree.exists('test/src/app/app.js')).toBeTruthy();
    });

    it('should generate host files and configs when --js=false', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();

      expect(tree.exists('test/src/bootstrap.tsx')).toBeTruthy();
      expect(tree.exists('test/src/main.ts')).toBeTruthy();
      expect(tree.exists('test/src/app/app.tsx')).toBeTruthy();
    });

    it('should generate host files and configs when --typescriptConfiguration=true', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: true,
        skipFormat: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();

      expect(tree.exists('test/rspack.config.prod.ts')).toBeTruthy();

      expect(tree.exists('test/rspack.config.ts')).toBeTruthy();
      expect(tree.read('test/rspack.config.ts', 'utf-8')).toMatchSnapshot();

      expect(tree.exists('test/module-federation.config.ts')).toBeTruthy();
      expect(
        tree.read('test/module-federation.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate host files and configs when --typescriptConfiguration=false', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();

      expect(tree.exists('test/rspack.config.prod.js')).toBeTruthy();

      expect(tree.exists('test/rspack.config.js')).toBeTruthy();
      expect(tree.read('test/rspack.config.js', 'utf-8')).toMatchSnapshot();

      expect(tree.exists('test/module-federation.config.js')).toBeTruthy();
      expect(
        tree.read('test/module-federation.config.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should install @nx/web for the file-server executor', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        skipFormat: true,
        bundler: 'rspack',
      });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@nx/web']).toBeDefined();
    });

    it('should generate host files and configs for SSR', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        ssr: true,
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.js')).toBeTruthy();
      expect(tree.exists('test/rspack.server.config.js')).toBeTruthy();
      expect(tree.exists('test/rspack.config.js')).toBeTruthy();
      expect(tree.exists('test/module-federation.config.js')).toBeTruthy();
      expect(
        tree.exists('test/module-federation.server.config.js')
      ).toBeTruthy();
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
        tree.read('test/rspack.server.config.js', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/module-federation.server.config.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate host files and configs for SSR when --typescriptConfiguration=true', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        ssr: true,
        style: 'css',
        linter: Linter.None,
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.ts')).toBeTruthy();
      expect(tree.exists('test/rspack.server.config.ts')).toBeTruthy();
      expect(tree.exists('test/rspack.config.ts')).toBeTruthy();
      expect(tree.exists('test/module-federation.config.ts')).toBeTruthy();
      expect(
        tree.exists('test/module-federation.server.config.ts')
      ).toBeTruthy();
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
        tree.read('test/rspack.server.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/module-federation.server.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a host and remotes in a directory correctly', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await hostGenerator(tree, {
        directory: 'foo/host-app',
        remotes: ['remote1', 'remote2', 'remote3'],
        e2eTestRunner: 'none',
        linter: Linter.None,
        style: 'css',
        unitTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.exists('foo/remote1/project.json')).toBeTruthy();
      expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
      expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
      expect(
        tree.read('foo/host-app/module-federation.config.js', 'utf-8')
      ).toContain(`'remote1', 'remote2', 'remote3'`);
    });

    it('should generate a host and remotes in a directory correctly when using --typescriptConfiguration=true', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await hostGenerator(tree, {
        directory: 'foo/host-app',
        remotes: ['remote1', 'remote2', 'remote3'],
        e2eTestRunner: 'none',
        linter: Linter.None,
        style: 'css',
        unitTestRunner: 'none',
        typescriptConfiguration: true,
        bundler: 'rspack',
      });

      expect(tree.exists('foo/remote1/project.json')).toBeTruthy();
      expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
      expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
      expect(
        tree.read('foo/host-app/module-federation.config.ts', 'utf-8')
      ).toContain(`'remote1', 'remote2', 'remote3'`);
    });

    it('should throw an error if invalid remotes names are provided and --dynamic is set to true', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const remote = 'invalid-remote-name';

      await expect(
        hostGenerator(tree, {
          directory: 'myhostapp',
          remotes: [remote],
          dynamic: true,
          e2eTestRunner: 'none',
          linter: Linter.None,
          style: 'css',
          unitTestRunner: 'none',
          typescriptConfiguration: false,
          bundler: 'rspack',
        })
      ).rejects.toThrowError(`Invalid remote name provided: ${remote}.`);
    });
  });
});
