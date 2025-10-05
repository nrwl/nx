import { CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/vite/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
  });

  describe('root project', () => {
    let tempFs: TempFs;
    beforeEach(async () => {
      tempFs = new TempFs('vite-plugin-tests');
      context = {
        configFiles: [],
        nxJsonConfiguration: {
          // These defaults should be overridden by plugin
          targetDefaults: {
            build: {
              cache: false,
              inputs: ['foo', '^foo'],
            },
          },
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };
      tempFs.createFileSync('vite.config.ts', '');
      tempFs.createFileSync('index.html', '');
      tempFs.createFileSync('package.json', '{}');
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });

    it('should not create nodes when react-router.config is present', async () => {
      tempFs.createFileSync('react-router.config.ts', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchInlineSnapshot(`
        [
          [
            "vite.config.ts",
            {
              "projects": {
                ".": {
                  "metadata": {},
                  "root": ".",
                  "targets": {},
                },
              },
            },
          ],
        ]
      `);
    });

    it('should create nodes when rollupOptions contains input', async () => {
      // Don't need index.html if we're setting inputs
      tempFs.removeFileSync('index.html');

      (loadViteDynamicImport as jest.Mock).mockResolvedValue({
        resolveConfig: jest.fn().mockResolvedValue({
          build: {
            rollupOptions: {
              input: { index: 'src/index.js' },
            },
          },
        }),
      });

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build-input',
          serveTargetName: 'serve-input',
        },
        context
      );

      const targets = nodes[0]?.[1]?.projects?.['.']?.targets;
      expect(targets?.['build-input']?.command).toMatch(/vite/);
      expect(targets?.['serve-input'].command).toMatch(/vite/);
    });

    it('should infer typecheck with -p flag when not using TS solution setup', async () => {
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes[0][1].projects['.'].targets.typecheck.command).toEqual(
        `tsc --noEmit -p tsconfig.json`
      );
      expect(nodes[0][1].projects['.'].targets.typecheck.metadata)
        .toMatchInlineSnapshot(`
        {
          "description": "Runs type-checking for the project.",
          "help": {
            "command": "npx tsc -p tsconfig.json --help",
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
        nodes[0][1].projects['.'].targets.typecheck.dependsOn
      ).toBeUndefined();
      expect(
        nodes[0][1].projects['.'].targets.typecheck.syncGenerators
      ).toBeUndefined();
    });

    it('should infer typecheck with --build flag when using TS solution setup', async () => {
      (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(true);
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes[0][1].projects['.'].targets.typecheck.command).toEqual(
        `tsc --build --emitDeclarationOnly`
      );
      expect(nodes[0][1].projects['.'].targets.typecheck.metadata)
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
      expect(nodes[0][1].projects['.'].targets.typecheck.dependsOn).toEqual([
        `^typecheck`,
      ]);
      expect(
        nodes[0][1].projects['.'].targets.typecheck.syncGenerators
      ).toEqual(['@nx/js:typescript-sync']);
    });

    it('should infer the sync generator when using TS solution setup', async () => {
      (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(true);
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes[0][1].projects['.'].targets.build.syncGenerators).toEqual([
        '@nx/js:typescript-sync',
      ]);
      expect(
        nodes[0][1].projects['.'].targets.typecheck.syncGenerators
      ).toEqual(['@nx/js:typescript-sync']);
    });
  });

  describe('not root project', () => {
    let tempFs: TempFs;
    beforeEach(() => {
      tempFs = new TempFs('test');
      context = {
        configFiles: [],
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
      tempFs.createFileSync('my-app/vite.config.ts', '');
      tempFs.createFileSync('my-app/index.html', '');
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
    });

    it('should create nodes', async () => {
      const nodes = await createNodesFunction(
        ['my-app/vite.config.ts'],
        {
          buildTargetName: 'build-something',
          serveTargetName: 'my-serve',
          previewTargetName: 'preview-site',
          testTargetName: 'vitest',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });

    it('should not create nodes when react-router.config is present', async () => {
      tempFs.createFileSync('my-app/react-router.config.ts', '');

      const nodes = await createNodesFunction(
        ['my-app/vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchInlineSnapshot(`
        [
          [
            "my-app/vite.config.ts",
            {
              "projects": {
                "my-app": {
                  "metadata": {},
                  "root": "my-app",
                  "targets": {},
                },
              },
            },
          ],
        ]
      `);
    });
  });

  describe('Library mode', () => {
    it('should exclude serve and preview targets when vite.config.ts is in library mode', async () => {
      const tempFs = new TempFs('test');
      (loadViteDynamicImport as jest.Mock).mockResolvedValue({
        resolveConfig: jest.fn().mockResolvedValue({
          build: {
            lib: {
              entry: 'index.ts',
              name: 'my-lib',
            },
          },
        }),
      }),
        (context = {
          configFiles: [],
          nxJsonConfiguration: {
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        });
      tempFs.createFileSync(
        'my-lib/project.json',
        JSON.stringify({ name: 'my-lib' })
      );
      tempFs.createFileSync('my-lib/vite.config.ts', '');

      const nodes = await createNodesFunction(
        ['my-lib/vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
      tempFs.cleanup();
    });
    it('should not exclude serve and preview targets when vite.config.ts is in library mode when user has defined a server config', async () => {
      const tempFs = new TempFs('test-exclude');
      (loadViteDynamicImport as jest.Mock).mockResolvedValue({
        resolveConfig: jest.fn().mockResolvedValue({
          build: {
            lib: {
              entry: 'index.ts',
              name: 'my-lib',
            },
          },
          server: {
            port: 3000,
            host: 'localhost',
          },
        }),
      }),
        (context = {
          configFiles: [],
          nxJsonConfiguration: {
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        });
      tempFs.createFileSync(
        'my-lib/project.json',
        JSON.stringify({ name: 'my-lib' })
      );
      tempFs.createFileSync('my-lib/vite.config.ts', '');

      const nodes = await createNodesFunction(
        ['my-lib/vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
        },
        context
      );

      expect(nodes).toMatchInlineSnapshot(`
        [
          [
            "my-lib/vite.config.ts",
            {
              "projects": {
                "my-lib": {
                  "metadata": {},
                  "projectType": "library",
                  "root": "my-lib",
                  "targets": {
                    "build": {
                      "cache": true,
                      "command": "vite build",
                      "dependsOn": [
                        "^build",
                      ],
                      "inputs": [
                        "production",
                        "^production",
                        {
                          "externalDependencies": [
                            "vite",
                          ],
                        },
                      ],
                      "metadata": {
                        "description": "Run Vite build",
                        "help": {
                          "command": "npx vite build --help",
                          "example": {
                            "options": {
                              "manifest": "manifest.json",
                              "sourcemap": true,
                            },
                          },
                        },
                        "technologies": [
                          "vite",
                        ],
                      },
                      "options": {
                        "cwd": "my-lib",
                      },
                      "outputs": [
                        "{workspaceRoot}/dist/{projectRoot}",
                      ],
                    },
                    "build-deps": {
                      "dependsOn": [
                        "^build",
                      ],
                    },
                    "dev": {
                      "command": "vite",
                      "continuous": true,
                      "metadata": {
                        "description": "Starts Vite dev server",
                        "help": {
                          "command": "npx vite --help",
                          "example": {
                            "options": {
                              "port": 3000,
                            },
                          },
                        },
                        "technologies": [
                          "vite",
                        ],
                      },
                      "options": {
                        "cwd": "my-lib",
                      },
                    },
                    "preview": {
                      "command": "vite preview",
                      "continuous": true,
                      "dependsOn": [
                        "build",
                      ],
                      "metadata": {
                        "description": "Locally preview Vite production build",
                        "help": {
                          "command": "npx vite preview --help",
                          "example": {
                            "options": {
                              "port": 3000,
                            },
                          },
                        },
                        "technologies": [
                          "vite",
                        ],
                      },
                      "options": {
                        "cwd": "my-lib",
                      },
                    },
                    "serve": {
                      "command": "vite",
                      "continuous": true,
                      "metadata": {
                        "deprecated": "Use devTargetName instead. This option will be removed in Nx 22.",
                        "description": "Starts Vite dev server",
                        "help": {
                          "command": "npx vite --help",
                          "example": {
                            "options": {
                              "port": 3000,
                            },
                          },
                        },
                        "technologies": [
                          "vite",
                        ],
                      },
                      "options": {
                        "cwd": "my-lib",
                      },
                    },
                    "serve-static": {
                      "continuous": true,
                      "executor": "@nx/web:file-server",
                      "options": {
                        "buildTarget": "build",
                        "spa": true,
                      },
                    },
                    "watch-deps": {
                      "command": "npx nx watch --projects my-lib --includeDependentProjects -- npx nx build-deps my-lib",
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
