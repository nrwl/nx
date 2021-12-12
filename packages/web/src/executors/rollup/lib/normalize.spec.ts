import { normalizeWebRollupOptions } from './normalize';
import { WebRollupOptions } from '../schema';

describe('normalizeWebRollupOptions', () => {
  let testOptions: WebRollupOptions;
  let root: string;
  let sourceRoot: string;

  beforeEach(() => {
    testOptions = {
      outputPath: '/tmp',
      project: 'apps/nodeapp/package.json',
      entryFile: 'apps/nodeapp/src/main.ts',
      tsConfig: 'apps/nodeapp/tsconfig.app.json',
      rollupConfig: 'apps/nodeapp/rollup.config',
      format: ['esm'],
    };
    root = '/root';
    sourceRoot = 'apps/nodeapp/src';
  });

  it('should resolve both node modules and relative path for rollupConfig', () => {
    let result = normalizeWebRollupOptions(testOptions, root, sourceRoot);
    expect(result.rollupConfig).toEqual(['/root/apps/nodeapp/rollup.config']);

    result = normalizeWebRollupOptions(
      {
        ...testOptions,
        // something that exists in node_modules
        rollupConfig: 'react',
      },
      root,
      sourceRoot
    );
    expect(result.rollupConfig).toHaveLength(1);
    expect(result.rollupConfig[0]).toMatch('react');
    expect(result.rollupConfig[0]).not.toMatch(root);
  });

  it('should handle rollupConfig being undefined', () => {
    delete testOptions.rollupConfig;

    const result = normalizeWebRollupOptions(testOptions, root, sourceRoot);
    expect(result.rollupConfig).toEqual([]);
  });
});
