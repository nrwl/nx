import type { Mock } from 'vitest';
import { type CreateNodesContext, workspaceRoot } from '@nx/devkit';
import {
  isUsingTsSolutionSetup,
  PNPM_INSTALL_SETTINGS_INPUTS,
  PNPM_MAJOR_RUNTIME_INPUT,
} from '@nx/js/internal';
import {
  hashObject,
  setWorkspaceRoot,
  workspaceDataDirectory,
} from '@nx/devkit/internal';
import { rmSync } from 'fs';
import { join } from 'path';
import { createNodes } from './plugin';
import { TempFs } from '@nx/devkit/internal-testing-utils';

vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(),
}));

// The real helper forks a process, which resolves Nx packages to their build
// output instead of this source. Call the module here under the cwd and env it
// would get instead, one call at a time since both are process-wide.
vi.mock('@nx/devkit/internal', async () => {
  let evaluations: Promise<unknown> = Promise.resolve();
  return {
    ...(await vi.importActual<any>('@nx/devkit/internal')),
    evaluateUnderTaskEnv: (modulePath, exportName, args, { cwd, env }) => {
      const evaluation = evaluations.then(async () => {
        const originalCwd = process.cwd();
        const originalEnv = process.env;
        process.chdir(cwd);
        process.env = env;
        try {
          return await (await import(modulePath))[exportName](...args);
        } finally {
          process.env = originalEnv;
          process.chdir(originalCwd);
        }
      });
      evaluations = evaluation.catch(() => {});
      return evaluation;
    },
  };
});

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
      { logMatches: 'Project is running at:' },
    ],
    [
      'an ipc of false',
      `export default { devServer: { port: 4300, ipc: false } };`,
      { logMatches: 'Project is running at:' },
    ],
    [
      'an ipc devServer with a quiet infrastructure log',
      `export default { devServer: { ipc: true }, infrastructureLogging: { level: 'none' } };`,
      undefined,
    ],
    [
      'an ipc devServer with its own infrastructure log console',
      `export default { devServer: { ipc: true }, infrastructureLogging: { console } };`,
      undefined,
    ],
    [
      'a NaN port with an unknown dev server major',
      `export default { devServer: { port: NaN } };`,
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

  describe.each([
    [
      '1.7.12',
      '1.1.5',
      'WEBPACK_DEV_SERVER_BASE_PORT',
      'Project is running at:',
      'WEBPACK_SERVE',
      'RSPACK_SERVE',
    ],
    [
      '2.2.7',
      '2.0.3',
      'RSPACK_DEV_SERVER_BASE_PORT',
      '  ➜  ',
      'RSPACK_SERVE',
      'WEBPACK_SERVE',
    ],
  ])(
    'with the dev server @rspack/cli %s loads from the project',
    (cliVersion, devServerVersion, envVar, logLine, serveFlag, otherFlag) => {
      beforeEach(() => {
        tempFs.createFilesSync({
          'my-app/node_modules/@rspack/cli/package.json': JSON.stringify({
            name: '@rspack/cli',
            version: cliVersion,
          }),
          'my-app/node_modules/@rspack/dev-server/package.json': JSON.stringify(
            { name: '@rspack/dev-server', version: devServerVersion }
          ),
        });
      });

      it('starts from its base port env var', async () => {
        tempFs.createFileSync('my-app/rspack.config.ts', `export default {};`);

        const nodes = await createNodesFunction(
          ['my-app/rspack.config.ts'],
          {},
          context
        );

        const { targets } = nodes[0][1].projects['my-app'];
        expect(targets.serve.readyWhen.port).toBe(
          `{options.port ?? env.${envVar} ?? 8080}`
        );
      });

      it('matches the address it logs for a NaN port', async () => {
        tempFs.createFileSync(
          'my-app/rspack.config.ts',
          `export default { devServer: { port: NaN } };`
        );

        const nodes = await createNodesFunction(
          ['my-app/rspack.config.ts'],
          {},
          context
        );

        const { targets } = nodes[0][1].projects['my-app'];
        expect(targets.serve.readyWhen).toEqual({ logMatches: logLine });
      });

      it('reads the config with only the serve flag its dev server sets', async () => {
        tempFs.createFileSync(
          'my-app/rspack.config.ts',
          `export default () => ({
            devServer: {
              port:
                process.env.${serveFlag} === 'true' && !process.env.${otherFlag}
                  ? 4300
                  : 9000,
            },
          });`
        );

        const nodes = await createNodesFunction(
          ['my-app/rspack.config.ts'],
          {},
          context
        );

        const { targets } = nodes[0][1].projects['my-app'];
        expect(targets.serve.readyWhen.port).toBe('{options.port ?? 4300}');
      });
    }
  );

  it.each([
    ['a port string', `'3000'`, 3000],
    ['an auto port', `'auto'`, undefined],
  ])('infers the serve-static port for %s', async (_, port, expected) => {
    tempFs.createFileSync(
      'my-app/rspack.config.ts',
      `export default { devServer: { port: ${port} } };`
    );

    const nodes = await createNodesFunction(
      ['my-app/rspack.config.ts'],
      {},
      context
    );

    const { targets } = nodes[0][1].projects['my-app'];
    expect(targets['serve-static'].options.port).toBe(expected);
  });

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

  it('reads the dev server port under the env and cwd of each task', async () => {
    const originalWorkspaceRoot = workspaceRoot;
    const originalNodeEnv = process.env.NODE_ENV;
    setWorkspaceRoot(tempFs.tempDir);
    // rspack serve sets it from --node-env only when it is unset
    delete process.env.NODE_ENV;
    tempFs.createFilesSync({
      'my-app/.env': 'SERVE_PORT=4300',
      'my-app/.env.preview': 'NODE_ENV=staging',
      'my-app/preview-port': '4400',
      'my-app/rspack.config.ts': `import { readFileSync } from 'fs';
      export default (env, argv) => {
        const { NODE_ENV, SERVE_PORT } = process.env;
        if (argv.nodeEnv === 'development' && NODE_ENV === 'development') {
          return { devServer: { port: Number(SERVE_PORT) } };
        }
        if (argv.nodeEnv === 'production' && NODE_ENV === 'staging') {
          return {
            devServer: { port: Number(readFileSync('preview-port', 'utf8')) },
          };
        }
        return { devServer: { port: 9000 } };
      };`,
    });

    try {
      const nodes = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        {},
        context
      );

      const { targets } = nodes[0][1].projects['my-app'];
      expect(targets.serve.readyWhen.port).toBe('{options.port ?? 4300}');
      expect(targets.preview.readyWhen.port).toBe('{options.port ?? 4400}');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      setWorkspaceRoot(originalWorkspaceRoot);
    }
  });

  it.each([
    [
      'a root dotenv file of the task changes',
      (tempFs: TempFs) =>
        tempFs.createFileSync('.env.serve-env-cache', 'SERVE_PORT=4500'),
    ],
    [
      'the ambient env changes',
      () => {
        process.env.SERVE_PORT = '4500';
      },
    ],
  ])(
    'reads the dev server port again when %s',
    async (_, change: (tempFs: TempFs) => void) => {
      const options = { serveTargetName: 'serve-env-cache' };
      const cachePath = join(
        workspaceDataDirectory,
        `rspack-${hashObject(options)}.hash`
      );
      rmSync(cachePath, { force: true });
      process.env.NX_CACHE_PROJECT_GRAPH = 'true';
      const originalWorkspaceRoot = workspaceRoot;
      setWorkspaceRoot(tempFs.tempDir);
      tempFs.createFileSync(
        'my-app/rspack.config.ts',
        `export default () => ({
          devServer: { port: Number(process.env.SERVE_PORT) || 4300 },
        });`
      );

      try {
        const before = await createNodesFunction(
          ['my-app/rspack.config.ts'],
          { ...options },
          context
        );
        expect(
          before[0][1].projects['my-app'].targets['serve-env-cache'].readyWhen
            .port
        ).toBe('{options.port ?? 4300}');

        change(tempFs);
        const after = await createNodesFunction(
          ['my-app/rspack.config.ts'],
          { ...options },
          context
        );
        expect(
          after[0][1].projects['my-app'].targets['serve-env-cache'].readyWhen
            .port
        ).toBe('{options.port ?? 4500}');
      } finally {
        delete process.env.SERVE_PORT;
        setWorkspaceRoot(originalWorkspaceRoot);
        rmSync(cachePath, { force: true });
      }
    }
  );

  it('infers no readyWhen and caches nothing when the dev server options cannot be read', async () => {
    const options = { serveTargetName: 'serve-read-failure' };
    const cachePath = join(
      workspaceDataDirectory,
      `rspack-${hashObject(options)}.hash`
    );
    rmSync(cachePath, { force: true });
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    // A file outside the cache key, so only a failure left uncached recovers
    const readableFlag = join(tempFs.tempDir, 'readable');
    tempFs.createFileSync(
      'my-app/rspack.config.ts',
      `import { existsSync } from 'fs';
      export default (env) => {
        if (env.RSPACK_SERVE && !existsSync(${JSON.stringify(readableFlag)})) {
          throw new Error('unreadable');
        }
        return { devServer: { port: 4300 } };
      };`
    );

    try {
      const failed = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        { ...options },
        context
      );
      expect(
        failed[0][1].projects['my-app'].targets['serve-read-failure'].readyWhen
      ).toBeUndefined();

      tempFs.createFileSync('readable', '');
      const recovered = await createNodesFunction(
        ['my-app/rspack.config.ts'],
        { ...options },
        context
      );
      expect(
        recovered[0][1].projects['my-app'].targets['serve-read-failure']
          .readyWhen
      ).toEqual({
        port: '{options.port ?? 4300}',
        host: '{options.host ?? localhost}',
      });
    } finally {
      rmSync(cachePath, { force: true });
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
