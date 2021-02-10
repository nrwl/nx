import { ExecutorContext } from '@nrwl/devkit';

let mockCopyPlugin = jest.fn();
jest.mock('rollup-plugin-copy', () => mockCopyPlugin);

jest.mock('tsconfig-paths-webpack-plugin');

import { createRollupOptions } from './package.impl';
import { PackageBuilderOptions } from '../../utils/types';
import { normalizePackageOptions } from '../../utils/normalize';

describe('packageExecutor', () => {
  let context: ExecutorContext;
  let testOptions: PackageBuilderOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      workspace: {
        version: 2,
        projects: {},
      },
      isVerbose: false,
      projectName: 'example',
      targetName: 'build',
    };
    testOptions = {
      entryFile: 'libs/ui/src/index.ts',
      outputPath: 'dist/ui',
      project: 'libs/ui/package.json',
      tsConfig: 'libs/ui/tsconfig.json',
      watch: false,
    };
  });

  describe('createRollupOptions', () => {
    it('should', () => {
      const result: any = createRollupOptions(
        normalizePackageOptions(testOptions, '/root', '/root/src'),
        [],
        context,
        { name: 'example' },
        '/root/src'
      );
      expect(result.map((x) => x.output)).toEqual([
        {
          file: '/root/dist/ui/example.umd.js',
          format: 'umd',
          globals: {},
          name: 'Example',
        },
        {
          file: '/root/dist/ui/example.esm.js',
          format: 'esm',
          globals: {},
          name: 'Example',
        },
      ]);
    });

    it(`should always use forward slashes for asset paths`, () => {
      createRollupOptions(
        {
          ...normalizePackageOptions(testOptions, '/root', '/root/src'),
          assets: [
            {
              glob: 'README.md',
              input: 'C:\\windows\\path',
              output: '.',
            },
          ],
        },
        [],
        context,
        { name: 'example' },
        '/root/src'
      );
      expect(mockCopyPlugin).toHaveBeenCalledWith({
        targets: [{ dest: '/root/dist/ui', src: 'C:/windows/path/README.md' }],
      });
    });
  });
});
