import { type CreateNodesContext, logger } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createScriptNodes } from './create-script-nodes';

describe('createScriptNodes', () => {
  const [glob, createNodes] = createScriptNodes({
    cacheName: 'test-scripts',
    technology: 'node',
    claims: (shebang) => shebang.interpreter === 'node',
    command: (file, shebang, watch) =>
      ['node', ...(watch ? ['--watch'] : []), ...shebang.args, file].join(' '),
  });
  const originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
  let tempFs: TempFs;
  let context: CreateNodesContext;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    tempFs = new TempFs('script-nodes');
    context = { nxJsonConfiguration: {}, workspaceRoot: tempFs.tempDir };
  });

  afterEach(() => {
    tempFs.cleanup();
    if (originalCacheProjectGraph === undefined) {
      delete process.env.NX_CACHE_PROJECT_GRAPH;
    } else {
      process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    }
  });

  async function run(files: Record<string, string>) {
    await tempFs.createFiles(files);
    return createNodes(Object.keys(files), {}, context);
  }

  it('should match scripts and project markers', () => {
    expect(glob).toContain('package.json');
    expect(glob).toContain('*.{js,cjs,mjs,ts,cts,mts}');
  });

  it('should infer a target per claimed script in its nearest project', async () => {
    const results = await run({
      'package.json': '{}',
      'tools/release/package.json': '{}',
      'tools/release/scripts/publish.ts':
        '#!/usr/bin/env -S node --enable-source-maps\n',
      'tools/release/src/index.ts': 'export {};\n',
      'tools/release/run.sh.js': '#!/bin/bash\n',
      'scripts/seed.mjs': '#!/usr/bin/env node\n',
    });

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "tools/release/scripts/publish.ts",
          {
            "projects": {
              "tools/release": {
                "root": "tools/release",
                "targets": {
                  "publish": {
                    "cache": false,
                    "command": "node --enable-source-maps scripts/publish.ts",
                    "metadata": {
                      "description": "Runs scripts/publish.ts",
                      "technologies": [
                        "node",
                      ],
                    },
                    "options": {
                      "cwd": "tools/release",
                    },
                  },
                },
              },
            },
          },
        ],
        [
          "scripts/seed.mjs",
          {
            "projects": {
              ".": {
                "root": ".",
                "targets": {
                  "seed": {
                    "cache": false,
                    "command": "node scripts/seed.mjs",
                    "metadata": {
                      "description": "Runs scripts/seed.mjs",
                      "technologies": [
                        "node",
                      ],
                    },
                    "options": {
                      "cwd": ".",
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

  it('should not reuse cached targets when the matched scripts change', async () => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    await tempFs.createFiles({
      'package.json': '{}',
      'scripts/a.js': '#!/usr/bin/env node\n',
      'scripts/b.js': '#!/usr/bin/env node\n',
    });

    // Same files on disk; a narrower include hands the plugin fewer scripts.
    const all = await createNodes(
      ['package.json', 'scripts/a.js', 'scripts/b.js'],
      {},
      context
    );
    const narrowed = await createNodes(
      ['package.json', 'scripts/a.js'],
      {},
      context
    );

    expect(Object.keys(all[0][1].projects['.'].targets)).toEqual(['a', 'b']);
    expect(Object.keys(narrowed[0][1].projects['.'].targets)).toEqual(['a']);
  });

  it('should disambiguate scripts that share a name', async () => {
    const results = await run({
      'package.json': '{}',
      'scripts/a/build.js': '#!/usr/bin/env node\n',
      'scripts/b/build.js': '#!/usr/bin/env node\n',
      'scripts/c/run.js': '#!/usr/bin/env node\n/** @nx name: build */\n',
    });

    expect(Object.keys(results[0][1].projects['.'].targets)).toEqual([
      'scripts/a/build',
      'scripts/b/build',
      'build',
    ]);
  });

  it('should apply frontmatter', async () => {
    const results = await run({
      'package.json': '{}',
      'scripts/dev.ts': [
        '#!/usr/bin/env node',
        '/** @nx',
        'name: dev-server',
        'description: Start the dev server',
        'watch: true',
        'dependsOn: [build]',
        'cwd: scripts',
        '*/',
      ].join('\n'),
      'scripts/skip.ts': '#!/usr/bin/env node\n/** @nx disable: true */\n',
    });

    expect(results[0][1].projects['.'].targets).toMatchInlineSnapshot(`
      {
        "dev-server": {
          "cache": false,
          "command": "node --watch dev.ts",
          "continuous": true,
          "dependsOn": [
            "build",
          ],
          "metadata": {
            "description": "Start the dev server",
            "technologies": [
              "node",
            ],
          },
          "options": {
            "cwd": "scripts",
          },
        },
      }
    `);
  });

  it('should merge options and metadata and drop mistyped keys', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const results = await run({
      'package.json': '{}',
      'scripts/seed.js': [
        '#!/usr/bin/env node',
        '/** @nx',
        'dependsOn: build',
        'options: { env: { SEED: "1" } }',
        'metadata: { owner: data }',
        'parallelism: false',
        '*/',
      ].join('\n'),
    });

    expect(results[0][1].projects['.'].targets.seed).toMatchInlineSnapshot(`
      {
        "cache": false,
        "command": "node scripts/seed.js",
        "metadata": {
          "description": "Runs scripts/seed.js",
          "owner": "data",
          "technologies": [
            "node",
          ],
        },
        "options": {
          "cwd": ".",
          "env": {
            "SEED": "1",
          },
        },
        "parallelism": false,
      }
    `);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '"dependsOn" in scripts/seed.js: expected array, got string'
      )
    );
    warn.mockRestore();
  });

  it('should quote script paths the shell would split', async () => {
    const results = await run({
      'package.json': '{}',
      'scripts/my tool.js': '#!/usr/bin/env node\n',
    });

    expect(results[0][1].projects['.'].targets['my tool'].command).toBe(
      'node "scripts/my tool.js"'
    );
  });

  it('should warn and fall back to defaults on malformed frontmatter', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const results = await run({
      'package.json': '{}',
      'scripts/broken.js': '#!/usr/bin/env node\n/* @nx\nname: [oops\n*/\n',
    });

    expect(Object.keys(results[0][1].projects['.'].targets)).toEqual([
      'broken',
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Ignoring the nx frontmatter in scripts/broken.js'
      )
    );
    warn.mockRestore();
  });
});
