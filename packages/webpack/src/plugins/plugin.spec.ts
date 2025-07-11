// Needed so the current environment is not used
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  getPackageManagerCommand: jest.fn(() => ({
    exec: 'npx',
  })),
}));

// Needed so the current environment is not used
jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  isUsingTsSolutionSetup: jest.fn(() => false),
}));

import { CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';

describe('@nx/webpack/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('webpack-plugin');

    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };

    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync('my-app/webpack.config.js', '');
  });

  afterEach(() => {
    jest.resetModules();
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
                      "args": [
                        "--node-env=production",
                      ],
                      "cwd": "my-app",
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
                      "args": [
                        "--node-env=development",
                      ],
                      "cwd": "my-app",
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
                      "args": [
                        "--node-env=production",
                      ],
                      "cwd": "my-app",
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
                    "command": "npx nx watch --projects my-app --includeDependentProjects -- npx nx build-deps my-app",
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

  function mockWebpackConfig(config: any) {
    jest.mock(join(tempFs.tempDir, 'my-app/webpack.config.js'), () => config, {
      virtual: true,
    });
  }
});
