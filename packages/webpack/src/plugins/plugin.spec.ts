// Needed so the current environment is not used
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  getPackageManagerCommand: jest.fn(() => ({
    exec: 'npx',
  })),
}));

// Needed so the current environment is not used
jest.mock('@nx/js/internal', () => ({
  ...jest.requireActual('@nx/js/internal'),
  isUsingTsSolutionSetup: jest.fn(() => false),
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
import { TempFs } from '@nx/devkit/internal-testing-utils';

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
    jest.resetModules();
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
                  },
                  "preview-site": {
                    "command": "webpack-cli serve",
                    "continuous": true,
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
                  },
                  "serve-static": {
                    "continuous": true,
                    "dependsOn": [
                      "build-something",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-something",
                      "port": 9000,
                      "spa": true,
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
    jest.mock(join(tempFs.tempDir, 'my-app/webpack.config.js'), () => config, {
      virtual: true,
    });
  }
});
