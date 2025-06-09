import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import type { StorybookConfig } from 'storybook/internal/types';
import { join } from 'node:path';
import { createNodesV2 } from './plugin';

describe('@nx/storybook/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('storybook-plugin');
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
    tempFs.createFileSync('package.json', JSON.stringify({ name: 'repo' }));
    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync(
      'my-ng-app/project.json',
      JSON.stringify({ name: 'my-ng-app' })
    );
    tempFs.createFileSync(
      'my-react-lib/project.json',
      JSON.stringify({ name: 'my-react-lib' })
    );
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
  });

  it('should create nodes', async () => {
    tempFs.createFileSync('my-app/.storybook/main.ts', '');
    mockStorybookMainConfig('my-app/.storybook/main.ts', {
      stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
      framework: {
        name: '@storybook/react-vite',
        options: {},
      },
    });

    const nodes = await createNodesFunction(
      ['my-app/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-app/.storybook/main.ts",
          {
            "projects": {
              "my-app": {
                "root": "my-app",
                "targets": {
                  "build-storybook": {
                    "cache": true,
                    "command": "storybook build",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "storybook",
                        ],
                      },
                    ],
                    "options": {
                      "cwd": "my-app",
                    },
                    "outputs": [
                      "{projectRoot}/storybook-static",
                      "{options.output-dir}",
                      "{options.outputDir}",
                      "{options.o}",
                    ],
                  },
                  "serve-storybook": {
                    "command": "storybook dev",
                    "continuous": true,
                    "options": {
                      "cwd": "my-app",
                    },
                  },
                  "static-storybook": {
                    "continuous": true,
                    "dependsOn": [
                      "build-storybook",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-storybook",
                      "staticFilePath": "my-app/storybook-static",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should create angular nodes', async () => {
    tempFs.createFileSync('my-ng-app/.storybook/main.ts', '');
    mockStorybookMainConfig('my-ng-app/.storybook/main.ts', {
      stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
      framework: {
        name: '@storybook/angular',
        options: {},
      },
    });

    const nodes = await createNodesFunction(
      ['my-ng-app/.storybook/main.ts'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-ng-app/.storybook/main.ts",
          {
            "projects": {
              "my-ng-app": {
                "root": "my-ng-app",
                "targets": {
                  "build-storybook": {
                    "cache": true,
                    "executor": "@storybook/angular:build-storybook",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "storybook",
                          "@storybook/angular",
                        ],
                      },
                    ],
                    "options": {
                      "browserTarget": "my-ng-app:build-storybook",
                      "compodoc": false,
                      "configDir": "my-ng-app/.storybook",
                      "outputDir": "my-ng-app/storybook-static",
                    },
                    "outputs": [
                      "{projectRoot}/storybook-static",
                      "{options.output-dir}",
                      "{options.outputDir}",
                      "{options.o}",
                    ],
                  },
                  "serve-storybook": {
                    "continuous": true,
                    "executor": "@storybook/angular:start-storybook",
                    "options": {
                      "browserTarget": "my-ng-app:build-storybook",
                      "compodoc": false,
                      "configDir": "my-ng-app/.storybook",
                    },
                  },
                  "static-storybook": {
                    "continuous": true,
                    "dependsOn": [
                      "build-storybook",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-storybook",
                      "staticFilePath": "my-ng-app/storybook-static",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  it('should support main.js', async () => {
    tempFs.createFileSync('my-react-lib/.storybook/main.js', '');
    mockStorybookMainConfig('my-react-lib/.storybook/main.js', {
      stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
      addons: ['@storybook/addon-essentials'],
      framework: {
        name: '@storybook/react-vite',
        options: {
          builder: {
            viteConfigPath: 'vite.config.js',
          },
        },
      },
    });

    const nodes = await createNodesFunction(
      ['my-react-lib/.storybook/main.js'],
      {
        buildStorybookTargetName: 'build-storybook',
        staticStorybookTargetName: 'static-storybook',
        serveStorybookTargetName: 'serve-storybook',
        testStorybookTargetName: 'test-storybook',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-react-lib/.storybook/main.js",
          {
            "projects": {
              "my-react-lib": {
                "root": "my-react-lib",
                "targets": {
                  "build-storybook": {
                    "cache": true,
                    "command": "storybook build",
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "storybook",
                        ],
                      },
                    ],
                    "options": {
                      "cwd": "my-react-lib",
                    },
                    "outputs": [
                      "{projectRoot}/storybook-static",
                      "{options.output-dir}",
                      "{options.outputDir}",
                      "{options.o}",
                    ],
                  },
                  "serve-storybook": {
                    "command": "storybook dev",
                    "continuous": true,
                    "options": {
                      "cwd": "my-react-lib",
                    },
                  },
                  "static-storybook": {
                    "continuous": true,
                    "dependsOn": [
                      "build-storybook",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build-storybook",
                      "staticFilePath": "my-react-lib/storybook-static",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });

  function mockStorybookMainConfig(
    mainTsPath: string,
    mainTsConfig: StorybookConfig
  ) {
    jest.mock(
      join(tempFs.tempDir, mainTsPath),
      () => ({ default: mainTsConfig }),
      { virtual: true }
    );
  }
});
