import { type CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

jest.mock('@rsbuild/core', () => ({
  ...jest.requireActual('@rsbuild/core'),
  loadConfig: jest.fn().mockResolvedValue({
    filePath: 'my-app/rsbuild.config.ts',
    content: {},
  }),
}));

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn().mockReturnValue(false),
}));

describe('@nx/rsbuild', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
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
                },
              },
            },
          },
        ],
      ]
    `);
  });
});
