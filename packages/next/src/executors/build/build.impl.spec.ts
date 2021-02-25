import { ExecutorContext } from '@nrwl/devkit';

import * as build from 'next/dist/build';

import { NextBuildBuilderOptions } from '../../utils/types';
import buildExecutor from './build.impl';

jest.mock('fs-extra');
jest.mock('next/dist/build');
jest.mock('./lib/create-package-json', () => {
  return {
    createPackageJson: () => Promise.resolve({}),
  };
});

describe('Next.js Builder', () => {
  let context: ExecutorContext;
  let options: NextBuildBuilderOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      projectName: 'my-app',
      targetName: 'build',
      workspace: {
        version: 2,
        projects: {},
      },
      isVerbose: false,
    };
    options = {
      root: 'apps/wibble',
      outputPath: 'dist/apps/wibble',
      fileReplacements: [
        {
          replace: 'apps/wibble/src/environment.ts',
          with: 'apps/wibble/src/environment.prod.ts',
        },
      ],
    };

    jest.spyOn(build, 'default').mockReturnValue(Promise.resolve());
  });

  it('should call next build', async () => {
    await buildExecutor(options, context);

    expect(build.default).toHaveBeenCalledWith(
      '/root/apps/wibble',
      expect.objectContaining({
        distDir: '../../dist/apps/wibble/.next',
        outdir: '../../dist/apps/wibble',
      })
    );
  });
});
