import { Tree, updateJson, writeJson } from '@nx/devkit';
import { ProjectGraph, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import hostGenerator from './host';

jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    createProjectGraphAsync: jest.fn().mockResolvedValue({
      dependencies: {},
      nodes: {},
    }),
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

  describe('bundler=rspack', () => {
    it('should generate host files and configs when --js=true', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: 'none',
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: false,
        skipFormat: true,
        js: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();

      expect(tree.exists('test/src/bootstrap.jsx')).toBeTruthy();
      expect(tree.exists('test/src/main.jsx')).toBeTruthy();
      expect(tree.exists('test/src/app/app.jsx')).toBeTruthy();
      // as no remotes provided, dynamic federation helper should not be included
      expect(tree.read('test/src/app/app.jsx', 'utf-8')).not.toEqual(
        expect.stringContaining(
          `import { loadRemote } from '@module-federation/enhanced/runtime';`
        )
      );
    });

    it('should generate host files and configs when --js=false', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        style: 'css',
        linter: 'none',
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
        linter: 'none',
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
        linter: 'none',
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
        linter: 'none',
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        skipFormat: true,
        bundler: 'rspack',
      });

      const packageJson = readJson(tree, 'package.json');
      console.log(packageJson);
      expect(packageJson.devDependencies['@nx/web']).toBeDefined();
    });

    it('should generate host files and configs for SSR', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        ssr: true,
        style: 'css',
        linter: 'none',
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.js')).toBeTruthy();
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
        tree.read('test/module-federation.server.config.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate host files and configs for SSR when --typescriptConfiguration=true', async () => {
      await hostGenerator(tree, {
        directory: 'test',
        ssr: true,
        style: 'css',
        linter: 'none',
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
        typescriptConfiguration: true,
        bundler: 'rspack',
      });

      expect(tree.exists('test/tsconfig.json')).toBeTruthy();
      expect(tree.exists('test/rspack.config.prod.ts')).toBeTruthy();
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
        tree.read('test/module-federation.server.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate a host and remotes in a directory correctly', async () => {
      const tree = createTreeWithEmptyWorkspace();

      await hostGenerator(tree, {
        directory: 'foo/host-app',
        remotes: ['remote1', 'remote2', 'remote3'],
        e2eTestRunner: 'none',
        linter: 'none',
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
        linter: 'none',
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
          linter: 'none',
          style: 'css',
          unitTestRunner: 'none',
          typescriptConfiguration: false,
          bundler: 'rspack',
        })
      ).rejects.toThrow(`Invalid remote name provided: ${remote}.`);
    });

    it('should generate create files with dynamic host', async () => {
      const tree = createTreeWithEmptyWorkspace();
      const remote = 'remote1';

      await hostGenerator(tree, {
        directory: 'myhostapp',
        remotes: [remote],
        dynamic: true,
        e2eTestRunner: 'none',
        linter: 'none',
        style: 'css',
        unitTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(tree.read('myhostapp/src/main.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { registerRemotes } from '@module-federation/enhanced/runtime';

        fetch('/assets/module-federation.manifest.json')
          .then((res) => res.json())
          .then((remotes: Record<string, string>) =>
            Object.entries(remotes).map(([name, entry]) => ({ name, entry }))
          )
          .then((remotes) => registerRemotes(remotes))
          .then(() => import('./bootstrap').catch((err) => console.error(err)));
        "
      `);
      expect(tree.read('myhostapp/src/app/app.tsx', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import * as React from 'react';
        import NxWelcome from './nx-welcome';
        import { Link, Route, Routes } from 'react-router-dom';
        import { loadRemote } from '@module-federation/enhanced/runtime';

        const Remote1 = React.lazy(() => loadRemote('remote1/Module') as any);

        export function App() {
          return (
            <React.Suspense fallback={null}>
              <ul>
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li>
                  <Link to="/remote1">Remote1</Link>
                </li>
              </ul>
              <Routes>
                <Route path="/" element={<NxWelcome title="myhostapp" />} />
                <Route path="/remote1" element={<Remote1 />} />
              </Routes>
            </React.Suspense>
          );
        }

        export default App;
        "
      `);
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await hostGenerator(tree, {
        directory: 'myapp',
        addPlugin: true,
        remotes: ['remote1', 'remote2', 'remote3'],
        e2eTestRunner: 'none',
        linter: 'none',
        style: 'css',
        unitTestRunner: 'none',
        typescriptConfiguration: false,
        bundler: 'rspack',
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./myapp",
          },
          {
            "path": "./remote1",
          },
          {
            "path": "./remote2",
          },
          {
            "path": "./remote3",
          },
        ]
      `);
      expect(readJson(tree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "../remote1",
            },
            {
              "path": "../remote2",
            },
            {
              "path": "../remote3",
            },
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.app.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "lib": [
              "dom",
            ],
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "dist",
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.app.tsbuildinfo",
            "types": [
              "node",
              "@nx/react/typings/cssmodule.d.ts",
              "@nx/react/typings/image.d.ts",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.tsx",
            "src/**/*.test.tsx",
            "src/**/*.spec.js",
            "src/**/*.test.js",
            "src/**/*.spec.jsx",
            "src/**/*.test.jsx",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.js",
            "src/**/*.jsx",
            "src/**/*.ts",
            "src/**/*.tsx",
          ],
          "references": [
            {
              "path": "../remote1/tsconfig.app.json",
            },
            {
              "path": "../remote2/tsconfig.app.json",
            },
            {
              "path": "../remote3/tsconfig.app.json",
            },
          ],
        }
      `);
    });
  });
});
