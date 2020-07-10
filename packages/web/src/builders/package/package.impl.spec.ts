import { of, throwError } from 'rxjs';
import { join } from 'path';

import { workspaces } from '@angular-devkit/core';

import * as f from '@nrwl/workspace/src/utils/fileutils';
import { MockBuilderContext } from '@nrwl/workspace/testing';

import * as impl from './package.impl';
import * as rr from './run-rollup';
import { getMockContext } from '../../utils/testing';
import { PackageBuilderOptions } from '../../utils/types';
import * as projectGraphUtils from '@nrwl/workspace/src/core/project-graph';
import { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { createRollupOptions } from './package.impl';
import { normalizePackageOptions } from '@nrwl/web/src/utils/normalize';

jest.mock('tsconfig-paths-webpack-plugin');

describe('WebPackagebuilder', () => {
  let context: MockBuilderContext;
  let testOptions: PackageBuilderOptions;
  let runRollup: jasmine.Spy;
  let writeJsonFile: jasmine.Spy;

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
  });
});
