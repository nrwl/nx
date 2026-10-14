import type { Mock } from 'vitest';
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

vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(),
}));

describe('@nx/rspack', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;

  beforeEach(() => {
    (isUsingTsSolutionSetup as Mock).mockReturnValue(false);
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
    vi.resetModules();
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
                    "configurations": {
                      "development": {
                        "args": [
                          "--node-env=development",
                        ],
                      },
                    },
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
                    "readyWhen": {
                      "host": "{options.host ?? localhost}",
                      "port": "{options.port ?? 9000}",
                    },
                  },
                  "serve": {
                    "command": "rspack serve",
                    "continuous": true,
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
                        "--node-env=development",
                      ],
                      "cwd": "my-app",
                      "env": {
                        "TS_NODE_COMPILER_OPTIONS": "{"module":"CommonJS","moduleResolution":"Node10","customConditions":null}",
                      },
                    },
                    "readyWhen": {
                      "host": "{options.host ?? localhost}",
                      "port": "{options.port ?? 9000}",
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
                          "@rspack/cli",
                        ],
                      },
                    ],
                    "options": {
                      "buildTarget": "build",
                      "port": 9000,
                      "spa": true,
                    },
                    "readyWhen": {
                      "host": "{options.host}",
                      "port": "{options.port}",
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

  it.each([
    [
      'no devServer',
      `export default {};`,
      {
        port: '{options.port ?? env.RSPACK_DEV_SERVER_BASE_PORT ?? 8080}',
        host: '{options.host ?? localhost}',
      },
    ],
    [
      'an auto port',
      `export default { devServer: { port: 'auto' } };`,
      {
        port: '{options.port ?? env.RSPACK_DEV_SERVER_BASE_PORT ?? 8080}',
        host: '{options.host ?? localhost}',
      },
    ],
    [
      'a port of 0',
      `export default { devServer: { port: 0 } };`,
      { port: '{options.port ?? 0}', host: '{options.host ?? localhost}' },
    ],
    [
      'a devServer on a later config',
      `export default [{ name: 'server' }, { name: 'client', devServer: { port: 4300 } }];`,
      { port: '{options.port ?? 4300}', host: '{options.host ?? localhost}' },
    ],
    [
      'a fixed host',
      `export default { devServer: { port: 4300, host: '192.168.1.20' } };`,
      {
        port: '{options.port ?? 4300}',
        host: '{options.host ?? 192.168.1.20}',
      },
    ],
    [
      'a host that reads as a token',
      `export default { devServer: { port: 4300, host: 'env.example.com' } };`,
      {
        port: '{options.port ?? 4300}',
        host: '{options.host ?? Env.example.com}',
      },
    ],
    [
      'an ipc devServer',
      `export default { devServer: { port: 4300, ipc: true } };`,
      undefined,
    ],
    [
      'an ipc of false',
      `export default { devServer: { port: 4300, ipc: false } };`,
      undefined,
    ],
  ])('infers the dev server readyWhen for %s', async (_, config, expected) => {
    tempFs.createFileSync('my-app/rspack.config.ts', config);

    const nodes = await createNodesFunction(
      ['my-app/rspack.config.ts'],
      {},
      context
    );

    const { targets } = nodes[0][1].projects['my-app'];
    for (const target of ['serve', 'preview']) {
      expect(targets[target].readyWhen).toEqual(expected);
    }
  });

  it.each([
    ['1.7.12', '1.1.5', 'WEBPACK_DEV_SERVER_BASE_PORT'],
    ['2.2.7', '2.0.3', 'RSPACK_DEV_SERVER_BASE_PORT'],
  ])(
    'starts from the base port env var of the dev server @rspack/cli %s loads from the project',
    async (cliVersion, devServerVersion, envVar) => {
      tempFs.createFilesSync({
        'my-app/rspack.config.ts': `export default {};`,
        'my-app/node_modules/@rspack/cli/package.json': JSON.stringify({
          name: '@rspack/cli',
          version: cliVersion,
        }),
        'my-app/node_modules/@rspack/dev-server/package.json': JSON.stringify({
          name: '@rspack/dev-server',
          version: devServerVersion,
        }),
      });

      const nodes = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        {},
        context
      );

      const { targets } = nodes[0][1].projects['my-app'];
      expect(targets.serve.readyWhen.port).toBe(
        `{options.port ?? env.${envVar} ?? 8080}`
      );
    }
  );

  it('reads the build outputs with the build env and the dev server port with the serve env', async () => {
    tempFs.createFileSync(
      'my-app/rspack.config.ts',
      `export default (env) => ({
        output: { path: env.RSPACK_SERVE ? 'dist/serve' : 'dist/build' },
        devServer: { port: env.RSPACK_SERVE ? 4300 : 9000 },
      });`
    );

    const nodes = await createNodesFunction(
      ['my-app/rspack.config.ts'],
      {},
      context
    );

    const { targets } = nodes[0][1].projects['my-app'];
    expect(targets.build.outputs).toEqual(['{projectRoot}/dist/build']);
    for (const target of ['serve', 'preview']) {
      expect(targets[target].readyWhen.port).toBe('{options.port ?? 4300}');
    }
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
