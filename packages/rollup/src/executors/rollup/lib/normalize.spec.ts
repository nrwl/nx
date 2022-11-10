import { RollupExecutorOptions } from '../schema';
import { normalizeRollupExecutorOptions } from './normalize';

describe('normalizeRollupExecutorOptions', () => {
  let testOptions: RollupExecutorOptions;
  let root: string;
  let sourceRoot: string;

  beforeEach(() => {
    testOptions = {
      outputPath: '/tmp',
      project: 'apps/nodeapp/package.json',
      main: 'apps/nodeapp/src/main.ts',
      tsConfig: 'apps/nodeapp/tsconfig.app.json',
      rollupConfig: 'apps/nodeapp/rollup.config',
      swcrc: 'apps/nodeapp/.lib.swcrc',
      format: ['esm'],
    };
    root = '/root';
    sourceRoot = 'apps/nodeapp/src';
  });

  it('should resolve both node modules and relative path for rollupConfig', () => {
    let result = normalizeRollupExecutorOptions(testOptions, root, sourceRoot);
    expect(result.rollupConfig).toEqual(['/root/apps/nodeapp/rollup.config']);

    result = normalizeRollupExecutorOptions(
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

    const result = normalizeRollupExecutorOptions(
      testOptions,
      root,
      sourceRoot
    );
    expect(result.rollupConfig).toEqual([]);
  });

  it('should resolve both node modules and relative path for swcrc', () => {
    let result = normalizeRollupExecutorOptions(testOptions, root, sourceRoot);
    expect(result.swcrc).toEqual('/root/apps/nodeapp/.lib.swcrc');

    result = normalizeRollupExecutorOptions(
      {
        ...testOptions,
        // something that exists in node_modules
        swcrc: '.lib.swcrc',
      },
      root,
      sourceRoot
    );
    expect(result.swcrc).toEqual('/root/.lib.swcrc');
  });

  it('should handle swcrc being undefined', () => {
    delete testOptions.swcrc;

    const result = normalizeRollupExecutorOptions(
      testOptions,
      root,
      sourceRoot
    );
    expect(result.swcrc).toEqual('');
  });
});
