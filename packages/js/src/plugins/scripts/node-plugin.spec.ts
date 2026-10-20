import type { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodes } from './node-plugin';

describe('@nx/js/node', () => {
  const createNodesFunction = createNodes[1];
  const originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
  let tempFs: TempFs;
  let context: CreateNodesContext;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    tempFs = new TempFs('node-scripts');
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

  async function targetsFor(
    files: Record<string, string>,
    root: string,
    options = {}
  ) {
    await tempFs.createFiles(files);
    // Only what the plugin glob would hand over; markers are found on disk.
    const matched = Object.keys(files).filter((f) => /\.[cm]?[jt]s$/.test(f));
    const results = await createNodesFunction(matched, options, context);
    return results.find(([, r]) => r.projects?.[root])?.[1].projects[root]
      .targets;
  }

  it('should only claim node shebangs', async () => {
    const targets = await targetsFor(
      {
        'package.json': '{}',
        'scripts/a.js': '#!/usr/bin/env node\n',
        'scripts/b.ts': '#!/usr/bin/env -S npx tsx\n',
      },
      '.'
    );

    expect(Object.keys(targets)).toEqual(['a']);
    expect(targets.a.command).toBe('node --watch scripts/a.js');
  });

  it('should infer serve from the header @nx/node:application writes', async () => {
    const targets = await targetsFor(
      {
        'apps/api/package.json': '{}',
        'apps/api/src/main.ts':
          '#!/usr/bin/env node\n// @nx-target-name: serve\nconsole.log("hi");\n',
      },
      'apps/api'
    );

    expect(targets).toEqual({
      serve: expect.objectContaining({
        command: 'node --watch src/main.ts',
        continuous: true,
        options: { cwd: 'apps/api' },
      }),
    });
  });

  it('should infer bin targets', async () => {
    const targets = await targetsFor(
      {
        'packages/cli/package.json': JSON.stringify({
          name: '@proj/cli',
          bin: { cli: './bin/cli.js', 'cli-dist': './dist/cli.js' },
        }),
        'packages/cli/bin/cli.js': 'require("../dist/cli.js");\n',
        'packages/tool/package.json': JSON.stringify({
          name: '@proj/tool',
          bin: 'dist/index.js',
        }),
      },
      'packages/cli'
    );

    expect(targets).toMatchInlineSnapshot(`
      {
        "cli": {
          "cache": false,
          "command": "node bin/cli.js",
          "metadata": {
            "description": "Runs the cli bin",
            "technologies": [
              "node",
            ],
          },
          "options": {
            "cwd": "packages/cli",
          },
        },
        "cli-dist": {
          "cache": false,
          "command": "node dist/cli.js",
          "dependsOn": [
            "build",
          ],
          "metadata": {
            "description": "Runs the cli-dist bin",
            "technologies": [
              "node",
            ],
          },
          "options": {
            "cwd": "packages/cli",
          },
        },
      }
    `);
  });

  it('should infer a string bin named after the unscoped package', async () => {
    const targets = await targetsFor(
      {
        'packages/tool/package.json': JSON.stringify({
          name: '@proj/tool',
          bin: 'dist/index.js',
        }),
        'packages/tool/src/index.ts': 'export {};\n',
      },
      'packages/tool',
      { binDependsOn: ['compile'] }
    );

    expect(targets.tool.command).toBe('node dist/index.js');
    expect(targets.tool.dependsOn).toEqual(['compile']);
  });

  it('should prefer a script target over a bin with the same name', async () => {
    const targets = await targetsFor(
      {
        'package.json': JSON.stringify({ bin: { release: './dist/r.js' } }),
        'scripts/release.mjs': '#!/usr/bin/env node\n',
      },
      '.'
    );

    expect(targets.release.command).toBe('node --watch scripts/release.mjs');
  });
});
