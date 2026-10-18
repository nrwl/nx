import { type CreateNodesContext } from '@nx/devkit';
import { createNodes } from './plugin';
import { mockCjsModule, TempFs } from '@nx/devkit/internal-testing-utils';

// The plugin `require`s `@rsbuild/core` lazily, which `vi.mock` cannot reach.
const loadConfig = vi.fn();
mockCjsModule(import.meta.url, '@rsbuild/core', { loadConfig });

describe('@nx/rsbuild', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
    loadConfig.mockResolvedValue({
      filePath: 'my-app/rsbuild.config.ts',
      content: {},
    });
    tempFs = new TempFs('rsbuild-test');
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
    tempFs.createFileSync('my-app/rsbuild.config.ts', `export default {};`);
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    vi.resetModules();
    tempFs.cleanup();
  });

  it('should create nodes', async () => {
    const nodes = await createNodesFunction(
      ['my-app/rsbuild.config.ts'],
      {
        buildTargetName: 'build-something',
        devTargetName: 'dev-serve',
        previewTargetName: 'preview-serve',
        inspectTargetName: 'inspect-serve',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "my-app/rsbuild.config.ts",
          {
            "projects": {
              "my-app": {
                "metadata": {},
                "root": "my-app",
                "targets": {
                  "build-deps": {
                    "dependsOn": [
                      "^build",
                    ],
                  },
                  "build-something": {
                    "cache": true,
                    "command": "rsbuild build",
                    "dependsOn": [
                      "^build-something",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@rsbuild/core",
                        ],
                      },
                    ],
                    "metadata": {
                      "description": "Run Rsbuild build",
                      "help": {
                        "command": "npx rsbuild build --help",
                        "example": {
                          "options": {
                            "watch": false,
                          },
                        },
                      },
                      "technologies": [
                        "rsbuild",
                      ],
                    },
                    "options": {
                      "args": [
                        "--mode=production",
                      ],
                      "cwd": "my-app",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/{projectRoot}",
                    ],
                  },
                  "dev-serve": {
                    "command": "rsbuild dev",
                    "continuous": true,
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@rsbuild/core",
                        ],
                      },
                    ],
                    "options": {
                      "args": [
                        "--mode=development",
                      ],
                      "cwd": "my-app",
                    },
                    "readyWhen": {
                      "command": "node -e "require('@nx/rsbuild/ready-check').waitForDevServer(process.argv[1], 'dev')" rsbuild.config.ts",
                      "interval": 1000,
                    },
                  },
                  "inspect-serve": {
                    "command": "rsbuild inspect",
                    "options": {
                      "cwd": "my-app",
                    },
                  },
                  "preview-serve": {
                    "command": "rsbuild preview",
                    "continuous": true,
                    "dependsOn": [
                      "build-something",
                      "^build-something",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@rsbuild/core",
                        ],
                      },
                    ],
                    "options": {
                      "args": [
                        "--mode=production",
                      ],
                      "cwd": "my-app",
                    },
                    "readyWhen": {
                      "command": "node -e "require('@nx/rsbuild/ready-check').waitForDevServer(process.argv[1], 'preview')" rsbuild.config.ts",
                      "interval": 1000,
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

  it('waits for the signal when the config loads pluginNxReadySignal()', async () => {
    // Rsbuild's plugins option nests arrays and promises
    loadConfig.mockResolvedValueOnce({
      filePath: 'my-app/rsbuild.config.ts',
      content: {
        plugins: [false, [Promise.resolve({ name: 'nx:ready-signal' })]],
      },
    });

    const nodes = await createNodesFunction(
      ['my-app/rsbuild.config.ts'],
      {},
      context
    );

    const targets = nodes[0][1].projects['my-app'].targets;
    expect(targets.dev.readyWhen).toEqual({ signal: true });
    expect(targets.preview.readyWhen).toEqual({ signal: true });
  });

  it('should not infer a typecheck target', async () => {
    tempFs.createFileSync('my-app/tsconfig.json', `{}`);

    const nodes = await createNodesFunction(
      ['my-app/rsbuild.config.ts'],
      {},
      context
    );

    expect(nodes[0][1].projects['my-app'].targets.typecheck).toBeUndefined();
  });

  describe('build outputs', () => {
    let projectCounter = 0;

    // Each call uses a fresh project so the plugin's config-file-hash cache
    // does not return a previous test's inferred targets.
    const inferBuildOutputs = async (
      distPathRoot: string | undefined
    ): Promise<string[]> => {
      const project = `apps/app-${projectCounter++}`;
      const configPath = `${project}/rsbuild.config.ts`;
      tempFs.createFileSync(
        `${project}/project.json`,
        JSON.stringify({ name: project })
      );
      // Unique content per case so the plugin's file-hash targets cache
      // does not serve another case's (or an earlier run's) inferred result.
      tempFs.createFileSync(
        configPath,
        `export default {}; // distPath.root=${distPathRoot ?? '(unset)'}`
      );
      loadConfig.mockResolvedValueOnce({
        filePath: configPath,
        content: distPathRoot
          ? { output: { distPath: { root: distPathRoot } } }
          : {},
      });

      const nodes = await createNodesFunction(
        [configPath],
        { buildTargetName: 'build' },
        context
      );

      return nodes[0][1].projects[project].targets.build.outputs;
    };

    it('should default to {workspaceRoot}/dist/{projectRoot} when distPath.root is not set', async () => {
      expect(await inferBuildOutputs(undefined)).toEqual([
        '{workspaceRoot}/dist/{projectRoot}',
      ]);
    });

    it('should use distPath.root as-is for a project-relative path', async () => {
      expect(await inferBuildOutputs('build')).toEqual(['{projectRoot}/build']);
    });

    it('should resolve a workspace-relative distPath.root without dropping the leaf directory', async () => {
      // Regression: the leaf directory must be kept - inferring
      // `{workspaceRoot}/dist` would capture sibling projects' outputs.
      expect(await inferBuildOutputs('../../dist/my-app')).toEqual([
        '{workspaceRoot}/dist/my-app',
      ]);
    });
  });
});
