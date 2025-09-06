import { type CreateNodesContext } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2 } from './plugin';

jest.mock('@rsbuild/core', () => ({
  ...jest.requireActual('@rsbuild/core'),
  loadConfig: jest.fn().mockResolvedValue({
    filePath: 'my-app/rsbuild.config.ts',
    content: {},
  }),
}));

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/rsbuild', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
    tempFs = new TempFs('rsbuild-test');
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
    tempFs.createFileSync('my-app/rsbuild.config.ts', `export default {};`);
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
                        "command": "npx --ignore-scripts rsbuild build --help",
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
                    "command": "npx --ignore-scripts nx watch --projects my-app --includeDependentProjects -- npx --ignore-scripts nx build-deps my-app",
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
          "command": "npx --ignore-scripts tsc -p tsconfig.json --help",
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
          "command": "npx --ignore-scripts tsc --build --help",
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
});
