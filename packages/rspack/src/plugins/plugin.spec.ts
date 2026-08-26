import { type CreateNodesContext } from '@nx/devkit';
import {
  isUsingTsSolutionSetup,
  PNPM_INSTALL_SETTINGS_INPUTS,
  PNPM_MAJOR_RUNTIME_INPUT,
} from '@nx/js/internal';
import { hashObject, workspaceDataDirectory } from '@nx/devkit/internal';
import { rmSync } from 'fs';
import { join } from 'path';
import { createNodes } from './plugin';
import { TempFs } from '@nx/devkit/internal-testing-utils';

jest.mock('@nx/js/internal', () => ({
  ...jest.requireActual('@nx/js/internal'),
  isUsingTsSolutionSetup: jest.fn(),
}));

describe('@nx/rspack', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;

  beforeEach(() => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);
    tempFs = new TempFs('rspack-test');
    context = {
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
    tempFs.createFileSync(
      'my-app/rspack.config.ts',
      `export default { devServer: { port: 9000 } };`
    );
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
                        "TS_NODE_COMPILER_OPTIONS": "{"module":"CommonJS","moduleResolution":"Node10","customConditions":null}",
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
                        "TS_NODE_COMPILER_OPTIONS": "{"module":"CommonJS","moduleResolution":"Node10","customConditions":null}",
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
                        "TS_NODE_COMPILER_OPTIONS": "{"module":"CommonJS","moduleResolution":"Node10","customConditions":null}",
                      },
                    },
                  },
                  "serve-static": {
                    "continuous": true,
                    "dependsOn": [
                      "build",
                    ],
                    "executor": "@nx/web:file-server",
                    "options": {
                      "buildTarget": "build",
                      "port": 9000,
                      "spa": true,
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

  it('adds the pnpm install settings inputs in a pnpm workspace', async () => {
    tempFs.removeFileSync('package-lock.json');
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');

    const nodes = await createNodesFunction(
      ['my-app/rspack.config.ts'],
      {},
      context
    );

    expect(nodes[0][1].projects['my-app'].targets.build.inputs).toEqual(
      expect.arrayContaining(PNPM_INSTALL_SETTINGS_INPUTS)
    );
  });

  it('omits the pnpm major runtime probe when the root package.json pins a pnpm version', async () => {
    tempFs.removeFileSync('package-lock.json');
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    tempFs.createFileSync(
      'package.json',
      JSON.stringify({ packageManager: 'pnpm@10.12.1' })
    );

    const nodes = await createNodesFunction(
      ['my-app/rspack.config.ts'],
      {},
      context
    );

    const inputs = nodes[0][1].projects['my-app'].targets.build.inputs;
    expect(inputs).toEqual(
      expect.arrayContaining(
        PNPM_INSTALL_SETTINGS_INPUTS.filter(
          (input) => input !== PNPM_MAJOR_RUNTIME_INPUT
        )
      )
    );
    expect(inputs).not.toContainEqual(PNPM_MAJOR_RUNTIME_INPUT);
  });

  it.each([
    ['another package manager', 'yarn@4.9.1'],
    ['a URL', 'pnpm@https://example.com/pnpm.tgz'],
    ['an unparseable version', 'pnpm@latest'],
  ])(
    'keeps the pnpm major runtime probe when the root packageManager field names %s',
    async (_, packageManager) => {
      tempFs.removeFileSync('package-lock.json');
      tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
      tempFs.createFileSync('package.json', JSON.stringify({ packageManager }));

      const nodes = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        {},
        context
      );

      expect(nodes[0][1].projects['my-app'].targets.build.inputs).toEqual(
        expect.arrayContaining(PNPM_INSTALL_SETTINGS_INPUTS)
      );
    }
  );

  it('recomputes cached targets when the root pnpm pin is removed', async () => {
    const options = { buildTargetName: 'build-pin-cache' };
    const cachePath = join(
      workspaceDataDirectory,
      `rspack-${hashObject(options)}.hash`
    );
    rmSync(cachePath, { force: true });
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    tempFs.removeFileSync('package-lock.json');
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    tempFs.createFileSync(
      'package.json',
      JSON.stringify({ packageManager: 'pnpm@10.12.1' })
    );

    try {
      const pinned = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        options,
        context
      );
      expect(
        pinned[0][1].projects['my-app'].targets['build-pin-cache'].inputs
      ).not.toContainEqual(PNPM_MAJOR_RUNTIME_INPUT);

      tempFs.writeFile('package.json', JSON.stringify({}));
      const unpinned = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        options,
        context
      );
      expect(
        unpinned[0][1].projects['my-app'].targets['build-pin-cache'].inputs
      ).toContainEqual(PNPM_MAJOR_RUNTIME_INPUT);
    } finally {
      rmSync(cachePath, { force: true });
    }
  });
});
