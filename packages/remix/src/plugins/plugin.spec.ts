import {
  type CreateNodesContextV2,
  detectPackageManager,
  joinPathFragments,
} from '@nx/devkit';
import { createNodesV2 as createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getLockFileName } from '@nx/js';

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/remix/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContextV2;
  let cwd = process.cwd();

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
  });

  describe('Remix Classic Compiler', () => {
    describe('root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
        context = {
          nxJsonConfiguration: {
            targetDefaults: {
              build: {
                cache: false,
                inputs: ['foo', '^foo'],
              },
              dev: {
                command: 'npm run dev',
              },
              start: {
                command: 'npm run start',
              },
              typecheck: {
                command: 'tsc',
              },
            },
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        };
        tempFs.createFileSync(
          'package.json',
          JSON.stringify('{name: "my-app", type: "module"}')
        );
        tempFs.createFileSync(
          'remix.config.cjs',
          `/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  watchPaths: () => require('@nx/remix').createWatchPaths(__dirname),
};
`
        );
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');
        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'typecheck',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchInlineSnapshot(`
          [
            [
              "remix.config.cjs",
              {
                "projects": {
                  ".": {
                    "metadata": {},
                    "root": ".",
                    "targets": {
                      "build": {
                        "cache": true,
                        "command": "remix build",
                        "dependsOn": [
                          "^build",
                        ],
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "@remix-run/dev",
                            ],
                          },
                        ],
                        "options": {
                          "cwd": ".",
                        },
                        "outputs": [
                          "{workspaceRoot}/build",
                          "{workspaceRoot}/public/build",
                        ],
                      },
                      "dev": {
                        "command": "remix dev --manual",
                        "continuous": true,
                        "options": {
                          "cwd": ".",
                        },
                      },
                      "serve-static": {
                        "command": "remix-serve build/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": ".",
                        },
                      },
                      "start": {
                        "command": "remix-serve build/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": ".",
                        },
                      },
                      "typecheck": {
                        "cache": true,
                        "command": "tsc --noEmit",
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "typescript",
                            ],
                          },
                        ],
                        "metadata": {
                          "description": "Runs type-checking for the project.",
                          "help": {
                            "command": "npx tsc --help",
                            "example": {
                              "options": {
                                "noEmit": true,
                              },
                            },
                          },
                          "technologies": [
                            "typescript",
                          ],
                        },
                        "options": {
                          "cwd": ".",
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
    });

    describe('non-root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
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
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');

        tempFs.createFileSync(
          'my-app/remix.config.cjs',
          `/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  watchPaths: () => require('@nx/remix').createWatchPaths(__dirname),
};
`
        );

        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchInlineSnapshot(`
          [
            [
              "my-app/remix.config.cjs",
              {
                "projects": {
                  "my-app": {
                    "metadata": {},
                    "root": "my-app",
                    "targets": {
                      "build": {
                        "cache": true,
                        "command": "remix build",
                        "dependsOn": [
                          "^build",
                        ],
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "@remix-run/dev",
                            ],
                          },
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                        "outputs": [
                          "{workspaceRoot}/my-app/build",
                          "{workspaceRoot}/my-app/public/build",
                        ],
                      },
                      "build-deps": {
                        "dependsOn": [
                          "^build",
                        ],
                      },
                      "dev": {
                        "command": "remix dev --manual",
                        "continuous": true,
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "serve-static": {
                        "command": "remix-serve build/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "start": {
                        "command": "remix-serve build/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "tsc": {
                        "cache": true,
                        "command": "tsc --noEmit",
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "typescript",
                            ],
                          },
                        ],
                        "metadata": {
                          "description": "Runs type-checking for the project.",
                          "help": {
                            "command": "npx tsc --help",
                            "example": {
                              "options": {
                                "noEmit": true,
                              },
                            },
                          },
                          "technologies": [
                            "typescript",
                          ],
                        },
                        "options": {
                          "cwd": "my-app",
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

      it('should infer watch-deps target', async () => {
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app"}')
        );

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
          },
          context
        );

        expect(nodes).toMatchInlineSnapshot(`
          [
            [
              "my-app/remix.config.cjs",
              {
                "projects": {
                  "my-app": {
                    "metadata": {},
                    "root": "my-app",
                    "targets": {
                      "build": {
                        "cache": true,
                        "command": "remix build",
                        "dependsOn": [
                          "^build",
                        ],
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "@remix-run/dev",
                            ],
                          },
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                        "outputs": [
                          "{workspaceRoot}/my-app/build",
                          "{workspaceRoot}/my-app/public/build",
                        ],
                      },
                      "build-deps": {
                        "dependsOn": [
                          "^build",
                        ],
                      },
                      "dev": {
                        "command": "remix dev --manual",
                        "continuous": true,
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "serve-static": {
                        "command": "remix-serve build/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "start": {
                        "command": "remix-serve build/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "tsc": {
                        "cache": true,
                        "command": "tsc --noEmit",
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "typescript",
                            ],
                          },
                        ],
                        "metadata": {
                          "description": "Runs type-checking for the project.",
                          "help": {
                            "command": "npx tsc --help",
                            "example": {
                              "options": {
                                "noEmit": true,
                              },
                            },
                          },
                          "technologies": [
                            "typescript",
                          ],
                        },
                        "options": {
                          "cwd": "my-app",
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

      it('should infer typecheck without --build flag when not using TS solution setup', async () => {
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app"}')
        );

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.command
        ).toEqual(`tsc --noEmit`);
        expect(nodes[0][1].projects['my-app'].targets.typecheck.metadata)
          .toMatchInlineSnapshot(`
          {
            "description": "Runs type-checking for the project.",
            "help": {
              "command": "npx tsc --help",
              "example": {
                "options": {
                  "noEmit": true,
                },
              },
            },
            "technologies": [
              "typescript",
            ],
          }
        `);
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.dependsOn
        ).toBeUndefined();
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.syncGenerators
        ).toBeUndefined();
      });

      it('should infer typecheck with --build flag when using TS solution setup', async () => {
        (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(true);
        tempFs.createFileSync(
          'my-app/package.json',
          JSON.stringify('{"name": "my-app", "version": "0.0.0"}')
        );

        const nodes = await createNodesFunction(
          ['my-app/remix.config.cjs'],
          { typecheckTargetName: 'typecheck' },
          context
        );

        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.command
        ).toEqual(`tsc --build --emitDeclarationOnly`);
        expect(nodes[0][1].projects['my-app'].targets.typecheck.metadata)
          .toMatchInlineSnapshot(`
          {
            "description": "Runs type-checking for the project.",
            "help": {
              "command": "npx tsc --build --help",
              "example": {
                "args": [
                  "--force",
                ],
              },
            },
            "technologies": [
              "typescript",
            ],
          }
        `);
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.dependsOn
        ).toEqual([`^typecheck`]);
        expect(
          nodes[0][1].projects['my-app'].targets.typecheck.syncGenerators
        ).toEqual(['@nx/js:typescript-sync']);
      });
    });
  });

  describe('Remix Vite Compiler', () => {
    describe('root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
        context = {
          nxJsonConfiguration: {
            targetDefaults: {
              build: {
                cache: false,
                inputs: ['foo', '^foo'],
              },
              dev: {
                command: 'npm run dev',
              },
              start: {
                command: 'npm run start',
              },
              typecheck: {
                command: 'tsc',
              },
            },
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        };
        tempFs.createFileSync(
          'package.json',
          JSON.stringify('{name: "my-app", type: "module"}')
        );
        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');
        tempFs.createFileSync(
          'vite.config.js',
          `const {defineConfig} = require('vite');
          const { vitePlugin: remix } = require('@remix-run/dev');
          module.exports = defineConfig({
             plugins:[remix()]
          });`
        );
        process.chdir(tempFs.tempDir);
        (loadViteDynamicImport as jest.Mock).mockResolvedValue({
          resolveConfig: jest.fn().mockResolvedValue({
            build: {
              lib: {
                entry: 'index.ts',
                name: 'my-app',
              },
            },
          }),
        });
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'typecheck',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchInlineSnapshot(`
          [
            [
              "vite.config.js",
              {
                "projects": {
                  ".": {
                    "metadata": {},
                    "root": ".",
                    "targets": {
                      "build": {
                        "cache": true,
                        "command": "remix vite:build",
                        "dependsOn": [
                          "^build",
                        ],
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "@remix-run/dev",
                            ],
                          },
                        ],
                        "options": {
                          "cwd": ".",
                        },
                        "outputs": [
                          "{workspaceRoot}/build",
                        ],
                      },
                      "dev": {
                        "command": "remix vite:dev",
                        "continuous": true,
                        "options": {
                          "cwd": ".",
                        },
                      },
                      "serve-static": {
                        "command": "remix-serve build/server/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": ".",
                        },
                      },
                      "start": {
                        "command": "remix-serve build/server/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": ".",
                        },
                      },
                      "typecheck": {
                        "cache": true,
                        "command": "tsc --noEmit",
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "typescript",
                            ],
                          },
                        ],
                        "metadata": {
                          "description": "Runs type-checking for the project.",
                          "help": {
                            "command": "npx tsc --help",
                            "example": {
                              "options": {
                                "noEmit": true,
                              },
                            },
                          },
                          "technologies": [
                            "typescript",
                          ],
                        },
                        "options": {
                          "cwd": ".",
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
    });

    describe('non-root project', () => {
      const tempFs = new TempFs('test');

      beforeEach(() => {
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

        tempFs.createFileSync(
          'my-app/vite.config.js',
          `const {defineConfig} = require('vite');
          const { vitePlugin: remix } = require('@remix-run/dev');
          module.exports = defineConfig({
             plugins:[remix()]
          });`
        );
        (loadViteDynamicImport as jest.Mock).mockResolvedValue({
          resolveConfig: jest.fn().mockResolvedValue({
            build: {
              lib: {
                entry: 'index.ts',
                name: 'my-app',
              },
            },
          }),
        });

        const lockFileName = getLockFileName(
          detectPackageManager(tempFs.tempDir)
        );
        tempFs.createFileSync(lockFileName, '');

        process.chdir(tempFs.tempDir);
      });

      afterEach(() => {
        jest.resetModules();
        tempFs.cleanup();
        process.chdir(cwd);
      });

      it('should create nodes', async () => {
        // ACT
        const nodes = await createNodesFunction(
          ['my-app/vite.config.js'],
          {
            buildTargetName: 'build',
            devTargetName: 'dev',
            startTargetName: 'start',
            typecheckTargetName: 'tsc',
          },
          context
        );

        // ASSERT
        expect(nodes).toMatchInlineSnapshot(`
          [
            [
              "my-app/vite.config.js",
              {
                "projects": {
                  "my-app": {
                    "metadata": {},
                    "root": "my-app",
                    "targets": {
                      "build": {
                        "cache": true,
                        "command": "remix vite:build",
                        "dependsOn": [
                          "^build",
                        ],
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "@remix-run/dev",
                            ],
                          },
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                        "outputs": [
                          "{workspaceRoot}/my-app/build",
                        ],
                      },
                      "build-deps": {
                        "dependsOn": [
                          "^build",
                        ],
                      },
                      "dev": {
                        "command": "remix vite:dev",
                        "continuous": true,
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "serve-static": {
                        "command": "remix-serve build/server/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "start": {
                        "command": "remix-serve build/server/index.js",
                        "continuous": true,
                        "dependsOn": [
                          "build",
                        ],
                        "options": {
                          "cwd": "my-app",
                        },
                      },
                      "tsc": {
                        "cache": true,
                        "command": "tsc --noEmit",
                        "inputs": [
                          "production",
                          "^production",
                          {
                            "externalDependencies": [
                              "typescript",
                            ],
                          },
                        ],
                        "metadata": {
                          "description": "Runs type-checking for the project.",
                          "help": {
                            "command": "npx tsc --help",
                            "example": {
                              "options": {
                                "noEmit": true,
                              },
                            },
                          },
                          "technologies": [
                            "typescript",
                          ],
                        },
                        "options": {
                          "cwd": "my-app",
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
    });
  });
});
