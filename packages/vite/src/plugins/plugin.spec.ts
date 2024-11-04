import { CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { loadViteDynamicImport } from '../utils/executor-utils';

jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    resolveConfig: jest.fn().mockResolvedValue({}),
  }),
}));

describe('@nx/vite/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;

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
      tempFs.createFileSync('package.json', '');
    });

    afterEach(() => {
      jest.resetModules();
      tempFs.cleanup();
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
          server: {},
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
                    "preview": {
                      "command": "vite preview",
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
                      "command": "vite serve",
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
                    "serve-static": {
                      "executor": "@nx/web:file-server",
                      "options": {
                        "buildTarget": "build",
                        "spa": true,
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
});
