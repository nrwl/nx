import { type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createNodesV2 } from './plugin';

describe('@nx/rolldown/plugin', () => {
  const createNodesFunction = createNodesV2[1];
  const originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
  let tempFs: TempFs;
  let context: CreateNodesContext;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    tempFs = new TempFs('rolldown-plugin');
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };
    tempFs.createFileSync('package-lock.json', '{}');
    // The bundled TS config imports 'rolldown', which must resolve from the temp workspace.
    mkdirSync(join(tempFs.tempDir, 'node_modules'));
    symlinkSync(
      dirname(require.resolve('rolldown/package.json')),
      join(tempFs.tempDir, 'node_modules', 'rolldown'),
      'dir'
    );
  });

  afterEach(() => {
    tempFs.cleanup();
    if (originalCacheProjectGraph !== undefined) {
      process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    } else {
      delete process.env.NX_CACHE_PROJECT_GRAPH;
    }
  });

  it('should infer a build target with outputs from every config entry', async () => {
    tempFs.createFileSync('apps/api/package.json', '{"name":"api"}');
    // Shape of @aws/nx-plugin's generated config: one entry per handler.
    tempFs.createFileSync(
      'apps/api/rolldown.config.ts',
      `import { defineConfig } from 'rolldown';

const handlers: string[] = ['create', 'list'];

export default defineConfig([
  ...handlers.map((name) => ({
    input: \`src/\${name}.ts\`,
    platform: 'node' as const,
    output: { file: \`../../dist/apps/api/bundle/\${name}/index.js\`, format: 'cjs' as const },
  })),
  { input: 'src/main.ts', output: [{ dir: 'dist/esm' }, { dir: 'dist/cjs', format: 'cjs' as const }] },
]);
`
    );

    const nodes = await createNodesFunction(
      ['apps/api/rolldown.config.ts'],
      {},
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "apps/api/rolldown.config.ts",
          {
            "projects": {
              "apps/api": {
                "root": "apps/api",
                "targets": {
                  "build": {
                    "cache": true,
                    "command": "rolldown -c rolldown.config.ts",
                    "dependsOn": [
                      "^build",
                    ],
                    "inputs": [
                      "production",
                      "^production",
                      {
                        "externalDependencies": [
                          "rolldown",
                        ],
                      },
                      {
                        "fields": [
                          "extends",
                          "files",
                          "include",
                        ],
                        "json": "{workspaceRoot}/tsconfig.json",
                      },
                    ],
                    "metadata": {
                      "description": "Run Rolldown",
                      "help": {
                        "command": "npx rolldown --help",
                        "example": {
                          "options": {
                            "sourcemap": true,
                            "watch": true,
                          },
                        },
                      },
                      "technologies": [
                        "rolldown",
                      ],
                    },
                    "options": {
                      "cwd": "apps/api",
                    },
                    "outputs": [
                      "{workspaceRoot}/dist/apps/api/bundle/create/index.js",
                      "{workspaceRoot}/dist/apps/api/bundle/create/index.js.map",
                      "{workspaceRoot}/dist/apps/api/bundle/list/index.js",
                      "{workspaceRoot}/dist/apps/api/bundle/list/index.js.map",
                      "{workspaceRoot}/apps/api/dist/esm",
                      "{workspaceRoot}/apps/api/dist/cjs",
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

  it('should support function configs, default output dir and a custom target name', async () => {
    tempFs.createFileSync('libs/util/project.json', '{"name":"util"}');
    tempFs.createFileSync(
      'libs/util/rolldown.config.mjs',
      `export default () => ({ input: 'src/index.js' });`
    );

    const nodes = await createNodesFunction(
      ['libs/util/rolldown.config.mjs'],
      { buildTargetName: 'bundle' },
      context
    );

    const targets = nodes[0][1].projects['libs/util'].targets;
    expect(Object.keys(targets)).toEqual(['bundle']);
    expect(targets.bundle.command).toBe('rolldown -c rolldown.config.mjs');
    expect(targets.bundle.dependsOn).toEqual(['^bundle']);
    expect(targets.bundle.outputs).toEqual(['{workspaceRoot}/libs/util/dist']);
  });

  it('should pick up edits to a JS config in the same process', async () => {
    tempFs.createFileSync('libs/util/project.json', '{"name":"util"}');
    const writeConfig = (dir: string) =>
      tempFs.createFileSync(
        'libs/util/rolldown.config.mjs',
        `export default { input: 'src/index.js', output: { dir: '${dir}' } };`
      );
    const outputs = async () =>
      (
        await createNodesFunction(
          ['libs/util/rolldown.config.mjs'],
          {},
          context
        )
      )[0][1].projects['libs/util'].targets.build.outputs;

    writeConfig('out-a');
    expect(await outputs()).toEqual(['{workspaceRoot}/libs/util/out-a']);
    writeConfig('out-b');
    expect(await outputs()).toEqual(['{workspaceRoot}/libs/util/out-b']);
  });

  it('should scope a single-file output to the file and its sourcemap', async () => {
    tempFs.createFileSync('apps/api/package.json', '{"name":"api"}');
    tempFs.createFileSync(
      'apps/api/rolldown.config.mjs',
      `export default { input: 'src/main.js', output: { file: 'bundle.js' } };`
    );

    const nodes = await createNodesFunction(
      ['apps/api/rolldown.config.mjs'],
      {},
      context
    );

    expect(nodes[0][1].projects['apps/api'].targets.build.outputs).toEqual([
      '{workspaceRoot}/apps/api/bundle.js',
      '{workspaceRoot}/apps/api/bundle.js.map',
    ]);
  });

  it('should load a config that reads external dependencies from package.json', async () => {
    tempFs.createFileSync(
      'apps/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { express: '*' } })
    );
    tempFs.createFileSync(
      'apps/api/rolldown.config.ts',
      [
        "import { defineConfig } from 'rolldown';",
        "import packageJson from './package.json' with { type: 'json' };",
        'const dependencies = Object.keys({ ...packageJson.dependencies });',
        'export default defineConfig([{',
        "  input: 'src/main.ts',",
        '  external: (id) => dependencies.some((dep) => id === dep || id.startsWith(`${dep}/`)),',
        "  output: { dir: 'dist' },",
        '}]);',
      ].join('\n')
    );

    const nodes = await createNodesFunction(
      ['apps/api/rolldown.config.ts'],
      {},
      context
    );

    expect(nodes[0][1].projects['apps/api'].targets.build.outputs).toEqual([
      '{workspaceRoot}/apps/api/dist',
    ]);
  });

  it('should skip config files outside a project root', async () => {
    tempFs.createFileSync(
      'scripts/rolldown.config.mjs',
      `export default { input: 'x.js' };`
    );

    const nodes = await createNodesFunction(
      ['scripts/rolldown.config.mjs'],
      {},
      context
    );

    expect(nodes).toEqual([]);
  });
});
