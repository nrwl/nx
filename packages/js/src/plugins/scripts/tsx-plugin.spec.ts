import type { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
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

  it('should only claim tsx shebangs', async () => {
    const files = {
      'package.json': JSON.stringify({ bin: { cli: './dist/cli.js' } }),
      'scripts/gen.ts': '#!/usr/bin/env -S npx tsx\n',
      'scripts/dev.ts': '#!/usr/bin/env tsx\n/** @nx watch: true */\n',
      'scripts/plain.js': '#!/usr/bin/env node\n',
    };
    await tempFs.createFiles(files);

    const [[, result]] = await createNodesFunction(
      Object.keys(files),
      {},
      context
    );

    const targets = result.projects['.'].targets;
    expect(Object.keys(targets)).toEqual(['gen', 'dev']);
    expect(targets.gen.command).toBe('tsx scripts/gen.ts');
    expect(targets.gen.metadata.technologies).toEqual(['tsx']);
    expect(targets.dev.command).toBe('tsx watch scripts/dev.ts');
    expect(targets.dev.continuous).toBe(true);
  });
});
