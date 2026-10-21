import { type CreateNodesContext } from '@nx/devkit';
import {
  emitPluginWorkerLog,
  globWithWorkspaceContext,
  resetWorkspaceContext,
} from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createScriptNodes } from './create-script-nodes';

vi.mock('@nx/devkit/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit/internal')>()),
  emitPluginWorkerLog: vi.fn(),
}));

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

  async function run(files: Record<string, string>, options = {}) {
    await tempFs.createFiles(files);
    // What the host would hand over for the plugin's glob.
    const matched = await globWithWorkspaceContext(tempFs.tempDir, [glob]);
    return createNodes(matched, options, context);
  }

  it('should match scripts and project markers', () => {
    expect(glob).toBe(
      '{**/!(*.spec|*.test|*.stories|*.d).{js,cjs,mjs,ts,cts,mts},**/package.json,**/project.json}'
    );
  });

  it('should not treat specs, tests, stories or typings as scripts', async () => {
    const results = await run({
      'package.json': '{ "name": "root", "nx": {} }',
      'scripts/seed.ts': '#!/usr/bin/env node\n',
      'scripts/seed.spec.ts': '#!/usr/bin/env node\n',
      'scripts/seed.test.js': '#!/usr/bin/env node\n',
      'scripts/seed.stories.ts': '#!/usr/bin/env node\n',
      'scripts/seed.d.ts': '#!/usr/bin/env node\n',
    });

    expect(Object.keys(results[0][1].projects['.'].targets)).toEqual(['seed']);
  });

  it('should infer a target per claimed script in its nearest project', async () => {
    const results = await run({
      'package.json': '{ "name": "root", "nx": {}, "workspaces": ["tools/*"] }',
      'tools/release/package.json': '{ "name": "release" }',
      'tools/release/scripts/publish.ts':
        '#!/usr/bin/env -S node --enable-source-maps\n',
      'tools/release/src/index.ts': 'export {};\n',
      'tools/release/run.sh.js': '#!/bin/bash\n',
      'scripts/seed.mjs': '#!/usr/bin/env node\n',
    });

    expect(results).toMatchInlineSnapshot(`
      [
        [
          "scripts/seed.mjs",
          {
            "projects": {
              ".": {
                "root": ".",
                "targets": {
                  "seed": {
                    "cache": false,
                    "command": "node --watch scripts/seed.mjs",
                    "continuous": true,
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
        [
          "tools/release/run.sh.js",
          {
            "projects": {
              "tools/release": {
                "root": "tools/release",
                "targets": {
                  "publish": {
                    "cache": false,
                    "command": "node --watch --enable-source-maps scripts/publish.ts",
                    "continuous": true,
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
      ]
    `);
  });

  it('should not reuse cached targets when the matched scripts change', async () => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    await tempFs.createFiles({
      'package.json': '{ "name": "root", "nx": {} }',
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

  it('should not reuse cached targets when a script header changes', async () => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    const before = await run({
      'package.json': '{ "name": "root", "nx": {} }',
      'scripts/seed.js': '#!/usr/bin/env node\n// @nx-target-name: seed\n',
    });

    tempFs.createFileSync(
      'scripts/seed.js',
      '#!/usr/bin/env node\n// @nx-target-name: reseed\n'
    );
    // A graph build after an edit starts from a fresh walk.
    resetWorkspaceContext();
    const after = await createNodes(
      ['package.json', 'scripts/seed.js'],
      {},
      context
    );

    expect(Object.keys(before[0][1].projects['.'].targets)).toEqual(['seed']);
    expect(Object.keys(after[0][1].projects['.'].targets)).toEqual(['reseed']);
  });

  it("should treat a package.json as a project root only where core's default package-json plugin does", async () => {
    const results = await run({
      'package.json':
        '{ "name": "root", "nx": {}, "workspaces": ["tools/esm"] }',
      // Outside the workspaces, no project.json: not a project, so its script
      // belongs to the root.
      'tools/scripts/package.json': '{ "type": "module" }',
      'tools/scripts/release.js': '#!/usr/bin/env node\n',
      'tools/named/package.json': '{ "type": "module" }',
      'tools/named/project.json': '{}',
      'tools/named/gen.js': '#!/usr/bin/env node\n',
      'tools/esm/package.json': '{ "type": "module" }',
      'tools/esm/run.js': '#!/usr/bin/env node\n',
    });

    expect(results.map(([, r]) => Object.keys(r.projects))).toEqual([
      ['tools/esm'],
      ['tools/named'],
      ['.'],
    ]);
    expect(Object.keys(results[0][1].projects['tools/esm'].targets)).toEqual([
      'run',
    ]);
    expect(Object.keys(results[1][1].projects['tools/named'].targets)).toEqual([
      'gen',
    ]);
    expect(Object.keys(results[2][1].projects['.'].targets)).toEqual([
      'release',
    ]);
  });

  it('should disambiguate scripts that share a name', async () => {
    const results = await run({
      'package.json': '{ "name": "root", "nx": {} }',
      'scripts/a/build.js': '#!/usr/bin/env node\n',
      'scripts/b/build.js': '#!/usr/bin/env node\n',
      'scripts/c/run.js': '#!/usr/bin/env node\n// @nx-target-name: build\n',
    });

    expect(Object.keys(results[0][1].projects['.'].targets)).toEqual([
      'scripts/a/build',
      'scripts/b/build',
      'build',
    ]);
  });

  it('should not watch when watch is false', async () => {
    const results = await run(
      {
        'package.json': '{ "name": "root", "nx": {} }',
        'scripts/seed.js': '#!/usr/bin/env node\n',
      },
      { watch: false }
    );

    expect(results[0][1].projects['.'].targets.seed).not.toHaveProperty(
      'continuous'
    );
    expect(results[0][1].projects['.'].targets.seed.command).toBe(
      'node scripts/seed.js'
    );
  });

  it('should run claimed scripts in watch mode by default', async () => {
    const results = await run({
      'package.json': '{ "name": "root", "nx": {} }',
      'src/main.ts': '#!/usr/bin/env node\n// @nx-target-name: serve\n',
    });

    expect(results[0][1].projects['.'].targets).toMatchInlineSnapshot(`
      {
        "serve": {
          "cache": false,
          "command": "node --watch src/main.ts",
          "continuous": true,
          "metadata": {
            "description": "Runs src/main.ts",
            "technologies": [
              "node",
            ],
          },
          "options": {
            "cwd": ".",
          },
        },
      }
    `);
  });

  it('should quote script paths the shell would split', async () => {
    const results = await run({
      'package.json': '{ "name": "root", "nx": {} }',
      'scripts/my tool.js': '#!/usr/bin/env node\n',
    });

    expect(results[0][1].projects['.'].targets['my tool'].command).toBe(
      'node --watch "scripts/my tool.js"'
    );
  });

  it('should warn and fall back to the file name on an invalid directive', async () => {
    const results = await run({
      'package.json': '{ "name": "root", "nx": {} }',
      'scripts/seed.js': '#!/usr/bin/env node\n// @nx-target-name:\n',
    });

    expect(Object.keys(results[0][1].projects['.'].targets)).toEqual(['seed']);
    expect(emitPluginWorkerLog).toHaveBeenCalledWith(
      'warn',
      'scripts/seed.js: "@nx-target-name" is empty.'
    );
  });
});
