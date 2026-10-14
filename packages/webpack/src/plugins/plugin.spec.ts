// Needed so the current environment is not used
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  getPackageManagerCommand: vi.fn(() => ({
    exec: 'npx',
  })),
}));

// Needed so the current environment is not used
vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(() => false),
}));

import { CreateNodesContext } from '@nx/devkit';
import {
  PNPM_INSTALL_SETTINGS_INPUTS,
  PNPM_MAJOR_RUNTIME_INPUT,
} from '@nx/js/internal';
import { hashObject, workspaceDataDirectory } from '@nx/devkit/internal';
import { rmSync } from 'fs';
import { createNodesV2 } from './plugin';
import { join } from 'path';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';

describe('@nx/webpack/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    tempFs = new TempFs('webpack-plugin');

    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };

    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync('my-app/webpack.config.js', '');
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    resetCjsMocks();
    vi.resetModules();
    tempFs.cleanup();
    if (originalCacheProjectGraph !== undefined) {
      process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    } else {
      delete process.env.NX_CACHE_PROJECT_GRAPH;
    }
  });

  it('should create nodes', async () => {
    mockWebpackConfig({
      output: {
        path: 'dist/foo',
      },
      devServer: {
        port: 9000,
      },
    });
    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      {
        buildTargetName: 'build-something',
        serveTargetName: 'my-serve',
        previewTargetName: 'preview-site',
        serveStaticTargetName: 'serve-static',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-app/webpack.config.js",
          {
            "projects": {
              "my-app": {
                "metadata": {},
                "projectType": "application",
                "targets": {
                  "build-deps": {
                    "dependsOn": [
                      "^build",
                    ],
                  },
                  "build-something": {
                    "cache": true,
                    "command": "webpack-cli build",
                    "configurations": {
                      "development": {
                        "env": {
                          "NODE_ENV": "development",
                        },
                      },
                    },
                    "dependsOn": [
                      "^build-something",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "webpack-cli",
                        ],
                      },
                      {
                        "fields": [
                          "extends",
                          "files",
                          "include",
                        ],
                        "json": "{workspaceRoot}/tsconfig.json",
                      },
                    ],
                    "metadata": {
                      "description": "Runs Webpack build",
                      "help": {
                        "command": "npx webpack-cli build --help",
                        "example": {
                          "args": [
                            "--profile",
                          ],
                          "options": {
                            "json": "stats.json",
                          },
                        },
                      },
                      "technologies": [
                        "webpack",
                      ],
                    },
                    "options": {
                      "cwd": "my-app",
                      "env": {
                        "NODE_ENV": "production",
                      },
                    },
                    "outputs": [
                      "{projectRoot}/dist/foo",
                    ],
                  },
                  "my-serve": {
                    "command": "webpack-cli serve",
                    "continuous": true,
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "webpack-cli",
                        ],
                      },
                      {
                        "fields": [
                          "extends",
                          "files",
                          "include",
                        ],
                        "json": "{workspaceRoot}/tsconfig.json",
                      },
                    ],
                    "metadata": {
                      "description": "Starts Webpack dev server",
                      "help": {
                        "command": "npx webpack-cli serve --help",
                        "example": {
                          "options": {
                            "args": [
                              "--client-progress",
                              "--history-api-fallback ",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "webpack",
                      ],
                    },
                    "options": {
                      "cwd": "my-app",
                      "env": {
                        "NODE_ENV": "development",
                      },
                    },
                    "readyWhen": {
                      "host": "{options.host ?? localhost}",
                      "port": "{options.port ?? 9000}",
                    },
                  },
                  "preview-site": {
                    "command": "webpack-cli serve",
                    "continuous": true,
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "webpack-cli",
                        ],
                      },
                      {
                        "fields": [
                          "extends",
                          "files",
                          "include",
                        ],
                        "json": "{workspaceRoot}/tsconfig.json",
                      },
                    ],
                    "metadata": {
                      "description": "Starts Webpack dev server in production mode",
                      "help": {
                        "command": "npx webpack-cli serve --help",
                        "example": {
                          "options": {
                            "args": [
                              "--client-progress",
                              "--history-api-fallback ",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "webpack",
                      ],
                    },
                    "options": {
                      "cwd": "my-app",
                      "env": {
                        "NODE_ENV": "production",
                      },
                    },
                    "readyWhen": {
                      "host": "{options.host ?? localhost}",
                      "port": "{options.port ?? 9000}",
                    },
                  },
                  "serve-static": {
                    "continuous": true,
                    "dependsOn": [
                      "build-something",
                    ],
                    "executor": "@nx/web:file-server",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "webpack-cli",
                        ],
                      },
                      {
                        "fields": [
                          "extends",
                          "files",
                          "include",
                        ],
                        "json": "{workspaceRoot}/tsconfig.json",
                      },
                    ],
                    "options": {
                      "buildTarget": "build-something",
                      "port": 9000,
                      "spa": true,
                    },
                    "readyWhen": {
                      "host": "{options.host}",
                      "port": "{options.port}",
                    },
                  },
                  "watch-deps": {
                    "command": "npx nx watch --projects my-app --includeDependencies -- npx nx build-deps my-app",
                    "continuous": true,
                    "dependsOn": [
                      "build-deps",
                    ],
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it.each([
    [
      'no devServer',
      { output: { path: 'dist/foo' } },
      {
        port: '{options.port ?? env.WEBPACK_DEV_SERVER_BASE_PORT ?? 8080}',
        host: '{options.host ?? localhost}',
      },
    ],
    [
      'an auto port',
      { devServer: { port: 'auto' } },
      {
        port: '{options.port ?? env.WEBPACK_DEV_SERVER_BASE_PORT ?? 8080}',
        host: '{options.host ?? localhost}',
      },
    ],
    [
      'a port of 0',
      { devServer: { port: 0 } },
      { port: '{options.port ?? 0}', host: '{options.host ?? localhost}' },
    ],
    [
      'a devServer on a later config',
      [{ name: 'server' }, { name: 'client', devServer: { port: 4300 } }],
      { port: '{options.port ?? 4300}', host: '{options.host ?? localhost}' },
    ],
    [
      'several devServer configs',
      [
        { name: 'server', devServer: { port: 4300 } },
        { name: 'client', devServer: { port: 4400 } },
      ],
      { port: '{options.port ?? 4400}', host: '{options.host ?? localhost}' },
    ],
    ['an ipc devServer', { devServer: { port: 4300, ipc: true } }, undefined],
    [
      'a fixed host',
      { devServer: { port: 4300, host: '192.168.1.20' } },
      {
        port: '{options.port ?? 4300}',
        host: '{options.host ?? 192.168.1.20}',
      },
    ],
    [
      'a host that reads as a token',
      { devServer: { port: 4300, host: 'env.example.com' } },
      {
        port: '{options.port ?? 4300}',
        host: '{options.host ?? Env.example.com}',
      },
    ],
  ])('infers the dev server readyWhen for %s', async (_, config, expected) => {
    mockWebpackConfig(config);

    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      {},
      context
    );

    const { targets } = nodes[0][1].projects['my-app'];
    for (const target of ['serve', 'preview']) {
      expect(targets[target].readyWhen).toEqual(expected);
    }
  });

  it.each([
    ['a port string', '3000', 3000],
    ['an auto port', 'auto', undefined],
  ])('infers the serve-static port for %s', async (_, port, expected) => {
    mockWebpackConfig({ devServer: { port } });

    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      {},
      context
    );

    const { targets } = nodes[0][1].projects['my-app'];
    expect(targets['serve-static'].options.port).toBe(expected);
  });

  it('reads the build outputs with the build env and the dev server port with the serve env', async () => {
    mockWebpackConfig((env: Record<string, unknown>) => ({
      output: { path: env.WEBPACK_SERVE ? 'dist/serve' : 'dist/build' },
      devServer: { port: env.WEBPACK_SERVE ? 4300 : 9000 },
    }));

    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      {},
      context
    );

    const { targets } = nodes[0][1].projects['my-app'];
    expect(targets.build.outputs).toEqual(['{projectRoot}/dist/build']);
    for (const target of ['serve', 'preview']) {
      expect(targets[target].readyWhen.port).toBe('{options.port ?? 4300}');
    }
  });

  it('adds the pnpm install settings inputs in a pnpm workspace', async () => {
    tempFs.removeFileSync('package-lock.json');
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    mockWebpackConfig({
      output: {
        path: 'dist/foo',
      },
    });

    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      {
        buildTargetName: 'build',
        serveTargetName: 'serve',
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
      },
      context
    );

    expect(nodes[0][1].projects['my-app'].targets.build.inputs).toEqual(
      expect.arrayContaining(PNPM_INSTALL_SETTINGS_INPUTS)
    );
  });

  it('omits the pnpm major runtime probe when the root package.json pins a pnpm version', async () => {
    tempFs.removeFileSync('package-lock.json');
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    tempFs.createFileSync(
      'package.json',
      JSON.stringify({ packageManager: 'pnpm@10.12.1' })
    );
    mockWebpackConfig({ output: { path: 'dist/foo' } });

    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      { buildTargetName: 'build' },
      context
    );

    const inputs = nodes[0][1].projects['my-app'].targets.build.inputs;
    expect(inputs).toEqual(
      expect.arrayContaining(
        PNPM_INSTALL_SETTINGS_INPUTS.filter(
          (input) => input !== PNPM_MAJOR_RUNTIME_INPUT
        )
      )
    );
    expect(inputs).not.toContainEqual(PNPM_MAJOR_RUNTIME_INPUT);
  });

  it.each([
    ['another package manager', 'yarn@4.9.1'],
    ['a URL', 'pnpm@https://example.com/pnpm.tgz'],
    ['an unparseable version', 'pnpm@latest'],
  ])(
    'keeps the pnpm major runtime probe when the root packageManager field names %s',
    async (_, packageManager) => {
      tempFs.removeFileSync('package-lock.json');
      tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
      tempFs.createFileSync('package.json', JSON.stringify({ packageManager }));
      mockWebpackConfig({ output: { path: 'dist/foo' } });

      const nodes = await createNodesFunction(
        ['my-app/webpack.config.js'],
        { buildTargetName: 'build' },
        context
      );

      expect(nodes[0][1].projects['my-app'].targets.build.inputs).toEqual(
        expect.arrayContaining(PNPM_INSTALL_SETTINGS_INPUTS)
      );
    }
  );

  it('recomputes cached targets when the root pnpm pin is removed', async () => {
    const options = { buildTargetName: 'build-pin-cache' };
    const cachePath = join(
      workspaceDataDirectory,
      `webpack-${hashObject(options)}.hash`
    );
    rmSync(cachePath, { force: true });
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    tempFs.removeFileSync('package-lock.json');
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    tempFs.createFileSync(
      'package.json',
      JSON.stringify({ packageManager: 'pnpm@10.12.1' })
    );
    mockWebpackConfig({ output: { path: 'dist/foo' } });

    try {
      const pinned = await createNodesFunction(
        ['my-app/webpack.config.js'],
        options,
        context
      );
      expect(
        pinned[0][1].projects['my-app'].targets['build-pin-cache'].inputs
      ).not.toContainEqual(PNPM_MAJOR_RUNTIME_INPUT);

      tempFs.writeFile('package.json', JSON.stringify({}));
      const unpinned = await createNodesFunction(
        ['my-app/webpack.config.js'],
        options,
        context
      );
      expect(
        unpinned[0][1].projects['my-app'].targets['build-pin-cache'].inputs
      ).toContainEqual(PNPM_MAJOR_RUNTIME_INPUT);
    } finally {
      rmSync(cachePath, { force: true });
    }
  });

  function mockWebpackConfig(config: any) {
    // loadConfigFile `require`s the config, which `vi.mock` cannot reach.
    mockCjsModule(
      import.meta.url,
      join(tempFs.tempDir, 'my-app/webpack.config.js'),
      config
    );
  }
});
