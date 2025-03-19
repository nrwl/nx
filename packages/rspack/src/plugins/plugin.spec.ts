import { type CreateNodesContext } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2 } from './plugin';

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/rspack', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
    tempFs = new TempFs('rspack-test');
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
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';

    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync('my-app/rspack.config.ts', `export default {};`);
    tempFs.createFileSync('package-lock.json', `{}`);
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    if (originalCacheProjectGraph !== undefined) {
      process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    } else {
      delete process.env.NX_CACHE_PROJECT_GRAPH;
    }
  });

  it('should handle missing lock file', async () => {
    tempFs.removeFileSync('package-lock.json');

    await expect(
      createNodesFunction(['my-app/rspack.config.ts'], {}, context)
    ).resolves.not.toThrow();
  });

  it('should infer tasks', async () => {
    await expect(createNodesFunction(['my-app/rspack.config.ts'], {}, context))
      .resolves.toMatchInlineSnapshot(`
      [
        [
          "my-app/rspack.config.ts",
          {
            "projects": {
              "my-app": {
                "metadata": {},
                "root": "my-app",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "rspack build",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "@rspack/cli",
                        ],
                      },
                    ],
                    "options": {
                      "args": [
                        "--node-env=production",
                      ],
                      "cwd": "my-app",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"Node10","module":"CommonJS"}",
                      },
                    },
                    "outputs": [],
                  },
                  "build-deps": {
                    "dependsOn": [
                      "^build",
                    ],
                  },
                  "preview": {
                    "command": "rspack serve",
                    "continuous": true,
                    "options": {
                      "args": [
                        "--node-env=production",
                      ],
                      "cwd": "my-app",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"Node10","module":"CommonJS"}",
                      },
                    },
                  },
                  "serve": {
                    "command": "rspack serve",
                    "continuous": true,
                    "options": {
                      "args": [
                        "--node-env=development",
                      ],
                      "cwd": "my-app",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"moduleResolution":"Node10","module":"CommonJS"}",
                      },
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
