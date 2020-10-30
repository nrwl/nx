const mockCopyPlugin = jest.fn();
jest.mock('rollup-plugin-copy', () => mockCopyPlugin);

import { MockBuilderContext } from '@nrwl/workspace/testing';

import { createRollupOptions } from './package.impl';
import { getMockContext } from '../../utils/testing';
import { PackageBuilderOptions } from '../../utils/types';
import { normalizePackageOptions } from '@nrwl/web/src/utils/normalize';

jest.mock('tsconfig-paths-webpack-plugin');

describe('WebPackagebuilder', () => {
  let context: MockBuilderContext;
  let testOptions: PackageBuilderOptions;

  beforeEach(async () => {
    context = await getMockContext();
    context.target.project = 'example';
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
