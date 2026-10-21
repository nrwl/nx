import type { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { minimatch } from 'minimatch';
import { createNodes } from './tsx-plugin';

describe('@nx/js/tsx', () => {
  const createNodesFunction = createNodes[1];
  const originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
  let tempFs: TempFs;
  let context: CreateNodesContext;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    tempFs = new TempFs('tsx-scripts');
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

  async function targetsFor(files: Record<string, string>, options = {}) {
    await tempFs.createFiles(files);
    // What the host would hand over for the plugin's glob.
    const matched = Object.keys(files).filter((f) =>
      minimatch(f, createNodes[0], { dot: true })
    );
    const [[, result]] = await createNodesFunction(matched, options, context);
    return result.projects['.'].targets;
  }

  it('should only claim tsx shebangs', async () => {
    const targets = await targetsFor({
      'package.json': JSON.stringify({
        name: 'root',
        bin: { cli: './dist/cli.js' },
      }),
      'scripts/gen.ts': '#!/usr/bin/env -S npx tsx\n',
      'scripts/plain.js': '#!/usr/bin/env node\n',
    });

    expect(Object.keys(targets)).toEqual(['gen']);
    expect(targets.gen.command).toBe('tsx watch scripts/gen.ts');
    expect(targets.gen.metadata.technologies).toEqual(['tsx']);
  });

  it('should put watch before shebang flags', async () => {
    const targets = await targetsFor({
      'package.json': '{ "name": "root" }',
      'scripts/dev.ts': '#!/usr/bin/env -S tsx --env-file=.env\n',
    });

    expect(targets.dev.command).toBe(
      'tsx watch --env-file=.env scripts/dev.ts'
    );
    expect(targets.dev.continuous).toBe(true);
  });
});
