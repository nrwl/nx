import { MockBuilderContext } from '@nrwl/workspace/testing';
import * as build from 'next/dist/build';
import { getMockContext } from '../../utils/testing';
import { NextBuildBuilderOptions } from '../../utils/types';
import { run } from './build.impl';

jest.mock('next/dist/build');
jest.mock('./lib/create-package-json', () => {
  return {
    createPackageJson: () => Promise.resolve({}),
  };
});

describe('Next.js Builder', () => {
  let context: MockBuilderContext;
  let options: NextBuildBuilderOptions;

  beforeEach(async () => {
    context = await getMockContext();

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
    await run(options, context).toPromise();

    expect(build.default).toHaveBeenCalledWith(
      '/root/apps/wibble',
      expect.objectContaining({
        distDir: '../../dist/apps/wibble/.next',
        outdir: '../../dist/apps/wibble',
      })
    );
  });
});
