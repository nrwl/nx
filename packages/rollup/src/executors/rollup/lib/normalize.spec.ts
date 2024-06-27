import { normalizeRollupExecutorOptions } from './normalize';
import { RollupExecutorOptions } from '../schema';

describe('normalizeRollupExecutorOptions', () => {
  let testOptions: RollupExecutorOptions;
  let root: string;

  beforeEach(() => {
    testOptions = {
      outputPath: '/tmp',
      project: 'apps/nodeapp/package.json',
      main: 'apps/nodeapp/src/main.ts',
      tsConfig: 'apps/nodeapp/tsconfig.app.json',
      rollupConfig: 'apps/nodeapp/rollup.config',
      format: ['esm'],
    };
    root = '/root';
  });

  it('should resolve both node modules and relative path for rollupConfig', () => {
    let result = normalizeRollupExecutorOptions(testOptions, {
      root,
      projectGraph: {
        nodes: { nodeapp: { data: { root: 'apps/nodeapp' } } },
      },
      projectName: 'nodeapp',
    } as any);
    expect(result.rollupConfig).toEqual(['/root/apps/nodeapp/rollup.config']);

    result = normalizeRollupExecutorOptions(
      {
        ...testOptions,
        // something that exists in node_modules
        rollupConfig: 'react',
      },
      {
        root,
        projectGraph: {
          nodes: { nodeapp: { data: { root: 'apps/nodeapp' } } },
        },
        projectName: 'nodeapp',
      } as any
    );
    expect(result.rollupConfig).toHaveLength(1);
    expect(result.rollupConfig[0]).toMatch('react');
    // This fails if the nx repo has been cloned in `/root/...`
    expect(result.rollupConfig[0]).not.toMatch(root);
  });

  it('should handle rollupConfig being undefined', () => {
    delete testOptions.rollupConfig;

    const result = normalizeRollupExecutorOptions(testOptions, {
      root,
      projectGraph: {
        nodes: { nodeapp: { data: { root: 'apps/nodeapp' } } },
      },
      projectName: 'nodeapp',
    } as any);
    expect(result.rollupConfig).toEqual([]);
  });
});
