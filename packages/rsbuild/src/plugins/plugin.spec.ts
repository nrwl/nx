import { type CreateNodesContext } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodes } from './plugin';

jest.mock('@rsbuild/core', () => ({
  ...jest.requireActual('@rsbuild/core'),
  loadConfig: jest.fn().mockResolvedValue({
    filePath: 'my-app/rsbuild.config.ts',
    content: {},
  }),
}));

jest.mock('@nx/js/internal', () => ({
  ...jest.requireActual('@nx/js/internal'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/rsbuild', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
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
    jest.resetModules();
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
        typecheckTargetName: 'typecheck-app',
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
                    "options": {
                      "args": [
                        "--mode=development",
                      ],
                      "cwd": "my-app",
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
                    "options": {
                      "args": [
                        "--mode=production",
                      ],
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

  it('should infer typecheck with -p flag when not using TS solution setup', async () => {
    tempFs.createFileSync('my-app/tsconfig.json', `{}`);

    const nodes = await createNodesFunction(
      ['my-app/rsbuild.config.ts'],
      { typecheckTargetName: 'typecheck' },
      context
    );

    expect(nodes[0][1].projects['my-app'].targets.typecheck.command).toEqual(
      `tsc -p tsconfig.json --noEmit`
    );
    expect(nodes[0][1].projects['my-app'].targets.typecheck.metadata)
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
      nodes[0][1].projects['my-app'].targets.typecheck.dependsOn
    ).toBeUndefined();
    expect(
      nodes[0][1].projects['my-app'].targets.typecheck.syncGenerators
    ).toBeUndefined();
  });

  it('should infer typecheck with --build flag when using TS solution setup', async () => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(true);
    tempFs.createFileSync('my-app/tsconfig.json', `{}`);

    const nodes = await createNodesFunction(
      ['my-app/rsbuild.config.ts'],
      { typecheckTargetName: 'typecheck' },
      context
    );

    expect(nodes[0][1].projects['my-app'].targets.typecheck.command).toEqual(
      `tsc --build --emitDeclarationOnly`
    );
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
    expect(nodes[0][1].projects['my-app'].targets.typecheck.dependsOn).toEqual([
      `^typecheck`,
    ]);
    expect(
      nodes[0][1].projects['my-app'].targets.typecheck.syncGenerators
    ).toEqual(['@nx/js:typescript-sync']);
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
      // `@rsbuild/core` is `require`d lazily inside the plugin, so grab the
      // same (mocked) module instance from the current registry.
      const { loadConfig } = require('@rsbuild/core');
      (loadConfig as jest.Mock).mockResolvedValueOnce({
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
