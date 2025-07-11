import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  ProjectGraph,
  readJson,
  readNxJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import remote from './remote';
import host from '../host/host';
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

  describe('bundler=rspack', () => {
    it('should set up continuous tasks when host is provided', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await host(tree, {
        directory: 'test/host',
        name: 'host',
        skipFormat: true,
        bundler: 'rspack',
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        unitTestRunner: 'jest',
        style: 'css',
      });

      await remote(tree, {
        directory: 'test/remote',
        name: 'remote',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        typescriptConfiguration: false,
        bundler: 'rspack',
        host: 'host',
      });

      const remoteProject = readProjectConfiguration(tree, 'remote');
      expect(remoteProject.targets.serve.dependsOn).toEqual(['host:serve']);
    });

    it('should create the remote with the correct config files', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await remote(tree, {
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.exists('test/rspack.config.js')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.js')).toBeTruthy();
      expect(tree.exists('test/module-federation.config.js')).toBeTruthy();

      expect(tree.read('test/rspack.config.js', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('test/rspack.config.prod.js', 'utf-8')
      ).toMatchSnapshot();
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
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        typescriptConfiguration: false,
        js: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/rspack.config.js')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.js')).toBeTruthy();
      expect(tree.exists('test/module-federation.config.js')).toBeTruthy();

      expect(tree.read('test/rspack.config.js', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('test/rspack.config.prod.js', 'utf-8')
      ).toMatchSnapshot();
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
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: false,
        style: 'css',
        unitTestRunner: 'jest',
        typescriptConfiguration: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/rspack.config.ts')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.ts')).toBeTruthy();
      expect(tree.exists('test/module-federation.config.ts')).toBeTruthy();

      expect(tree.read('test/rspack.config.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('test/rspack.config.prod.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/module-federation.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should install @nx/web for the file-server executor', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await remote(tree, {
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        bundler: 'rspack',
      });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@nx/web']).toBeDefined();
    });

    it('should not set the remote as the default project', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await remote(tree, {
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        bundler: 'rspack',
      });

      const { defaultProject } = readNxJson(tree);
      expect(defaultProject).toBeUndefined();
    });

    it('should generate a remote-specific server.ts file for --ssr', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await remote(tree, {
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        ssr: true,
        bundler: 'rspack',
      });

      const mainFile = tree.read('test/server.ts', 'utf-8');
      expect(mainFile).toContain(
        `join(process.cwd(), '../dist/test', 'browser')`
      );
      expect(mainFile).toContain('nx.server.ready');
    });

    it('should generate correct remote with config files when using --ssr', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await remote(tree, {
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: true,
        style: 'css',
        unitTestRunner: 'jest',
        ssr: true,
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(
        tree.exists('test/module-federation.server.config.js')
      ).toBeTruthy();

      expect(
        tree.read('test/module-federation.server.config.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate correct remote with config files when using --ssr and --typescriptConfiguration=true', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await remote(tree, {
        directory: 'test',
        devServerPort: 4201,
        e2eTestRunner: 'cypress',
        linter: 'eslint',
        skipFormat: false,
        style: 'css',
        unitTestRunner: 'jest',
        ssr: true,
        typescriptConfiguration: true,
        bundler: 'rspack',
      });

      expect(
        tree.exists('test/module-federation.server.config.ts')
      ).toBeTruthy();

      expect(
        tree.read('test/module-federation.server.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should throw an error if invalid remotes names are provided and --dynamic is set to true', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const name = 'invalid-dynamic-remote-name';
      await expect(
        remote(tree, {
          directory: name,
          devServerPort: 4209,
          dynamic: true,
          e2eTestRunner: 'cypress',
          linter: 'eslint',
          skipFormat: false,
          style: 'css',
          unitTestRunner: 'jest',
          ssr: true,
          typescriptConfiguration: true,
          bundler: 'rspack',
        })
      ).rejects.toThrow(`Invalid remote name provided: ${name}.`);
    });

    it('should throw an error when an invalid remote name is used', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await expect(
        remote(tree, {
          directory: 'test/my-app',
          devServerPort: 4209,
          e2eTestRunner: 'cypress',
          linter: 'eslint',
          skipFormat: false,
          style: 'css',
          unitTestRunner: 'jest',
          ssr: true,
          typescriptConfiguration: true,
          bundler: 'rspack',
        })
      ).rejects.toMatchInlineSnapshot(`
        [Error: Invalid remote name: my-app. Remote project names must:
        - Start with a letter, dollar sign ($) or underscore (_)
        - Followed by any valid character (letters, digits, underscores, or dollar signs)
        The regular expression used is ^[a-zA-Z_$][a-zA-Z_$0-9]*$.]
      `);
    });
  });
});
