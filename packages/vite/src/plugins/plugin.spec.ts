import type { Mock } from 'vitest';
import { CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { loadViteDynamicImport } from '../utils/executor-utils';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';

vi.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: vi.fn().mockResolvedValue({
    resolveConfig: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(),
}));

describe('@nx/vite/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;

  beforeEach(() => {
    (isUsingTsSolutionSetup as Mock).mockReturnValue(false);
  });

  describe('root project', () => {
    let tempFs: TempFs;
    beforeEach(async () => {
      tempFs = new TempFs('vite-plugin-tests');
      context = {
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
      tempFs.createFileSync('package-lock.json', '{}');
    });

    afterEach(() => {
      vi.resetModules();
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

      (loadViteDynamicImport as Mock).mockResolvedValue({
        resolveConfig: vi.fn().mockResolvedValue({
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

    it('waits for the signal when the config loads nxReadySignal()', async () => {
      (loadViteDynamicImport as Mock).mockResolvedValueOnce({
        resolveConfig: vi
          .fn()
          .mockResolvedValue({ plugins: [{ name: 'nx-ready-signal' }] }),
      });

      const nodes = await createNodesFunction(['vite.config.ts'], {}, context);

      const targets = nodes[0]?.[1]?.projects?.['.']?.targets;
      expect(targets.dev.readyWhen).toEqual({ signal: true });
      expect(targets.preview.readyWhen).toEqual({ signal: true });
    });

    it.each([false, true])(
      'should not infer typecheck for non-Vue projects (TS solution: %s)',
      async (tsSolution) => {
        (isUsingTsSolutionSetup as Mock).mockReturnValue(tsSolution);
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

        expect(nodes[0][1].projects['.'].targets.typecheck).toBeUndefined();
      }
    );

    it.each([false, true])(
      'should not infer typecheck when compiler option is tsgo (TS solution: %s)',
      async (tsSolution) => {
        (isUsingTsSolutionSetup as Mock).mockReturnValue(tsSolution);
        tempFs.createFileSync('tsconfig.json', '');

        const nodes = await createNodesFunction(
          ['vite.config.ts'],
          {
            buildTargetName: 'build',
            serveTargetName: 'serve',
            previewTargetName: 'preview',
            testTargetName: 'test',
            serveStaticTargetName: 'serve-static',
            compiler: 'tsgo',
          },
          context
        );

        expect(nodes[0][1].projects['.'].targets.typecheck).toBeUndefined();
      }
    );

    it('should infer a vue-tsc --noEmit typecheck for Vue projects when not using TS solution setup', async () => {
      (loadViteDynamicImport as Mock).mockResolvedValueOnce({
        resolveConfig: vi
          .fn()
          .mockResolvedValue({ plugins: [{ name: 'vite:vue' }] }),
      });
      tempFs.createFileSync('tsconfig.json', '');
      tempFs.createFileSync('tsconfig.app.json', '');

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

      const typecheck = nodes[0][1].projects['.'].targets.typecheck;
      expect(typecheck.command).toEqual(
        `vue-tsc -p tsconfig.app.json --noEmit`
      );
      expect(typecheck.dependsOn).toBeUndefined();
      expect(typecheck.syncGenerators).toBeUndefined();
      expect(typecheck.metadata.technologies).toEqual(['typescript', 'vue']);
    });

    it('should not infer typecheck for Vue projects when compiler option is tsc', async () => {
      (loadViteDynamicImport as Mock).mockResolvedValueOnce({
        resolveConfig: vi
          .fn()
          .mockResolvedValue({ plugins: [{ name: 'vite:vue' }] }),
      });
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
          compiler: 'tsc',
        },
        context
      );

      expect(nodes[0][1].projects['.'].targets.typecheck).toBeUndefined();
    });

    it('should use vue-tsc when compiler option is vue-tsc (for non-detected Vue setups)', async () => {
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
          compiler: 'vue-tsc',
        },
        context
      );

      const typecheck = nodes[0][1].projects['.'].targets.typecheck;
      expect(typecheck.command).toEqual(`vue-tsc --noEmit`);
      expect(typecheck.inputs).toContainEqual({
        externalDependencies: ['vue-tsc', 'typescript'],
      });
    });

    it('should infer a vue-tsc typecheck for Vue projects when using TS solution setup', async () => {
      (isUsingTsSolutionSetup as Mock).mockReturnValue(true);
      (loadViteDynamicImport as Mock).mockResolvedValueOnce({
        resolveConfig: vi
          .fn()
          .mockResolvedValue({ plugins: [{ name: 'vite:vue' }] }),
      });
      tempFs.createFileSync(
        'vite.config.ts',
        `import vue from '@vitejs/plugin-vue';`
      );
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

      const { build, typecheck } = nodes[0][1].projects['.'].targets;
      expect(build.syncGenerators).toEqual(['@nx/js:typescript-sync']);
      expect(typecheck.command).toEqual(
        `vue-tsc --build --emitDeclarationOnly`
      );
      expect(typecheck.dependsOn).toEqual(['build', '^typecheck']);
      expect(typecheck.syncGenerators).toEqual(['@nx/js:typescript-sync']);
      expect(typecheck.inputs).toContainEqual({
        externalDependencies: ['vue-tsc', 'typescript'],
      });
      expect(typecheck.metadata.technologies).toEqual(['typescript', 'vue']);
      expect(typecheck.metadata.help).toEqual({
        command: 'npx vue-tsc --build --help',
        example: { args: ['--force'] },
      });
    });

    it('should not infer typecheck when typecheckTargetName is false', async () => {
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
          typecheckTargetName: false,
        },
        context
      );

      const targets = nodes[0][1].projects['.'].targets;
      expect(targets.typecheck).toBeUndefined();
      expect(targets['false']).toBeUndefined();
    });

    it('should not infer a vue-tsc typecheck when typecheckTargetName is false and using TS solution setup', async () => {
      (isUsingTsSolutionSetup as Mock).mockReturnValue(true);
      tempFs.createFileSync('tsconfig.json', '');

      const nodes = await createNodesFunction(
        ['vite.config.ts'],
        {
          buildTargetName: 'build',
          serveTargetName: 'serve',
          previewTargetName: 'preview',
          testTargetName: 'test',
          serveStaticTargetName: 'serve-static',
          typecheckTargetName: false,
          compiler: 'vue-tsc',
        },
        context
      );

      const targets = nodes[0][1].projects['.'].targets;
      expect(targets.typecheck).toBeUndefined();
      expect(targets['false']).toBeUndefined();
    });
  });

  describe('not root project', () => {
    let tempFs: TempFs;
    beforeEach(() => {
      tempFs = new TempFs('test');
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
      tempFs.createFileSync('my-app/vite.config.ts', '');
      tempFs.createFileSync('my-app/index.html', '');
      tempFs.createFileSync('package-lock.json', '{}');
    });

    afterEach(() => {
      vi.resetModules();
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
    const lib = { entry: 'index.ts', name: 'my-lib' };
    const applicationTargets = ['dev', 'serve', 'preview', 'serve-static'];

    // Runs the config hooks Vite runs before resolving: the user's plugins, then
    // the injected one. As in Vite, the resolved config always has a server.
    function mockResolveConfig(
      getUserConfig: (command: 'build' | 'serve') => Record<string, any>
    ) {
      return vi.fn(async ({ plugins }, command) => {
        let config = getUserConfig(command);
        for (const plugin of [...(config.plugins ?? []), ...plugins]) {
          if (!plugin.apply || plugin.apply === command) {
            const hook = plugin.config?.handler ?? plugin.config;
            config = { ...config, ...(await hook?.(config, { command })) };
          }
        }
        return {
          ...config,
          server: { port: 5173, host: 'localhost', ...config.server },
        };
      });
    }

    async function inferProject(
      resolveConfig: Mock,
      extraFiles: string[] = []
    ) {
      const tempFs = new TempFs('test-library');
      (loadViteDynamicImport as Mock).mockResolvedValue({ resolveConfig });
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
        'my-lib/project.json',
        JSON.stringify({ name: 'my-lib' })
      );
      // Unique content, so the plugin's target cache can't answer for the mock.
      tempFs.createFileSync('my-lib/vite.config.ts', `// ${tempFs.tempDir}`);
      tempFs.createFileSync('package-lock.json', '{}');
      extraFiles.forEach((file) => tempFs.createFileSync(file, ''));

      const nodes = await createNodesFunction(
        ['my-lib/vite.config.ts'],
        {},
        context
      );
      tempFs.cleanup();

      const { targets, projectType } = nodes[0][1].projects['my-lib'];
      return {
        targets,
        projectType,
        inferredApplicationTargets: applicationTargets.filter(
          (target) => target in targets
        ),
        resolvedCommands: resolveConfig.mock.calls.map(
          ([, command]) => command
        ),
      };
    }

    it('should exclude serve and preview targets when vite.config.ts is in library mode', async () => {
      const tempFs = new TempFs('test');
      ((loadViteDynamicImport as Mock).mockResolvedValue({
        resolveConfig: vi.fn().mockResolvedValue({
          build: {
            lib: {
              entry: 'index.ts',
              name: 'my-lib',
            },
          },
          server: {
            port: 5173,
            host: 'localhost',
          },
        }),
      }),
        (context = {
          nxJsonConfiguration: {
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        }));
      tempFs.createFileSync(
        'my-lib/project.json',
        JSON.stringify({ name: 'my-lib' })
      );
      tempFs.createFileSync('my-lib/vite.config.ts', '');
      tempFs.createFileSync('package-lock.json', '{}');

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
      const userConfig = {
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
      };
      ((loadViteDynamicImport as Mock).mockResolvedValue({
        resolveConfig: mockResolveConfig(() => userConfig),
      }),
        (context = {
          nxJsonConfiguration: {
            namedInputs: {
              default: ['{projectRoot}/**/*'],
              production: ['!{projectRoot}/**/*.spec.ts'],
            },
          },
          workspaceRoot: tempFs.tempDir,
        }));
      tempFs.createFileSync(
        'my-lib/project.json',
        JSON.stringify({ name: 'my-lib' })
      );
      tempFs.createFileSync('my-lib/vite.config.ts', '');
      tempFs.createFileSync('package-lock.json', '{}');

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
                      "readyWhen": {
                        "command": "node -e "require('@nx/vite/ready-check').waitForDevServer(process.argv[1], 'serve')" vite.config.ts",
                        "interval": 1000,
                      },
                    },
                    "preview": {
                      "command": "vite preview",
                      "continuous": true,
                      "dependsOn": [
                        "build",
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
                      "readyWhen": {
                        "command": "node -e "require('@nx/vite/ready-check').waitForDevServer(process.argv[1], 'preview')" vite.config.ts",
                        "interval": 1000,
                      },
                    },
                    "serve": {
                      "command": "vite",
                      "continuous": true,
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
                      "readyWhen": {
                        "command": "node -e "require('@nx/vite/ready-check').waitForDevServer(process.argv[1], 'serve')" vite.config.ts",
                        "interval": 1000,
                      },
                    },
                    "serve-static": {
                      "continuous": true,
                      "dependsOn": [
                        "build",
                      ],
                      "executor": "@nx/web:file-server",
                      "inputs": [
                        "production",
                        "^production",
                        {
                          "externalDependencies": [
                            "vite",
                          ],
                        },
                      ],
                      "options": {
                        "buildTarget": "build",
                        "spa": true,
                      },
                      "readyWhen": {
                        "signal": true,
                      },
                    },
                    "watch-deps": {
                      "command": "npx nx watch --projects my-lib --includeDependencies -- npx nx build-deps my-lib",
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

    it('should keep the application targets when only the serve config has a server, with build outputs from the build config', async () => {
      const resolveConfig = mockResolveConfig((command) => ({
        build: {
          lib,
          outDir: command === 'build' ? 'dist-build' : 'dist-serve',
        },
        server: command === 'serve' ? { port: 4200 } : undefined,
      }));

      const {
        targets,
        projectType,
        inferredApplicationTargets,
        resolvedCommands,
      } = await inferProject(resolveConfig);

      expect(inferredApplicationTargets).toEqual(applicationTargets);
      expect(targets.build.outputs).toEqual(['{projectRoot}/dist-build']);
      expect(projectType).toEqual('library');
      expect(resolvedCommands).toEqual(['build', 'serve']);
    });

    it.each([
      ['in both modes', {}, ['build']],
      ['only in serve mode', { apply: 'serve' }, ['build', 'serve']],
    ])(
      'should keep the application targets when a plugin config hook sets the server %s',
      async (_, pluginOptions, expectedCommands) => {
        const resolveConfig = mockResolveConfig(() => ({
          build: { lib },
          plugins: [
            {
              name: 'user-plugin',
              config: () => ({ server: { port: 4200 } }),
              ...pluginOptions,
            },
          ],
        }));

        const { inferredApplicationTargets, resolvedCommands } =
          await inferProject(resolveConfig);

        expect(inferredApplicationTargets).toEqual(applicationTargets);
        expect(resolvedCommands).toEqual(expectedCommands);
      }
    );

    it('should keep the build target and omit the application targets when the config throws in serve mode', async () => {
      const resolveConfig = mockResolveConfig((command) => {
        if (command === 'serve') {
          throw new Error('This config only builds');
        }
        return { build: { lib } };
      });

      const { targets, inferredApplicationTargets } =
        await inferProject(resolveConfig);

      expect(targets.build.command).toEqual('vite build');
      expect(inferredApplicationTargets).toEqual([]);
      expect(resolveConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({ logLevel: 'silent' }),
        'serve'
      );
    });

    it('should keep the application targets for an explicit empty server block', async () => {
      const { inferredApplicationTargets, resolvedCommands } =
        await inferProject(
          mockResolveConfig(() => ({ build: { lib }, server: {} }))
        );

      expect(inferredApplicationTargets).toEqual(applicationTargets);
      expect(resolvedCommands).toEqual(['build']);
    });

    it('should exclude the application targets when neither mode has a server', async () => {
      const { inferredApplicationTargets, resolvedCommands } =
        await inferProject(mockResolveConfig(() => ({ build: { lib } })));

      expect(inferredApplicationTargets).toEqual([]);
      expect(resolvedCommands).toEqual(['build', 'serve']);
    });

    it.each([
      ['an application', { build: {} }, ['my-lib/index.html']],
      [
        'a library with a build mode server',
        { build: { lib }, server: { port: 3000 } },
        [],
      ],
    ])(
      'should resolve the config once for %s',
      async (_, userConfig, extraFiles) => {
        const resolveConfig = mockResolveConfig(() => userConfig);

        const { inferredApplicationTargets, resolvedCommands } =
          await inferProject(resolveConfig, extraFiles);

        expect(inferredApplicationTargets).toEqual(applicationTargets);
        expect(resolvedCommands).toEqual(['build']);
        expect(resolveConfig.mock.calls[0][0].logLevel).toBeUndefined();
      }
    );

    it.each([
      ['a Remix plugin', { plugins: [{ name: 'remix' }] }, []],
      ['a React Router config', {}, ['my-lib/react-router.config.ts']],
    ])(
      'should not check serve mode for a library with %s',
      async (_, userConfig, extraFiles) => {
        const { targets, resolvedCommands } = await inferProject(
          mockResolveConfig(() => ({ build: { lib }, ...userConfig })),
          extraFiles
        );

        expect(targets.build).toBeUndefined();
        expect(resolvedCommands).toEqual(['build']);
      }
    );
  });
});
