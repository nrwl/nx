import * as impl from './bundle.impl';
import * as rr from './run-rollup';
import { of } from 'rxjs';
import { getMockContext, MockBuilderContext } from '../../utils/testing';
import { workspaces } from '@angular-devkit/core';
import { join } from 'path';
import * as f from '@nrwl/workspace/src/utils/fileutils';
import { BundleBuilderOptions } from '../../utils/types';

jest.mock('tsconfig-paths-webpack-plugin');

describe('WebBuildBuilder', () => {
  let context: MockBuilderContext;
  let testOptions: BundleBuilderOptions;
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
      watch: false
    };
    spyOn(workspaces, 'readWorkspace').and.returnValue({
      workspace: {
        projects: {
          get: () => ({
            sourceRoot: join(__dirname, '../../..')
          })
        }
      }
    });
    spyOn(f, 'readJsonFile').and.returnValue({
      name: 'example'
    });
    writeJsonFile = spyOn(f, 'writeJsonFile');
  });

  describe('run', () => {
    it('should call runRollup with esm, cjs, and umd', async () => {
      runRollup = spyOn(rr, 'runRollup').and.callFake(() => {
        return of({
          success: true
        });
      });

      const result = await impl.run(testOptions, context).toPromise();

      expect(runRollup).toHaveBeenCalled();
      expect(runRollup.calls.allArgs().map(x => x[0].output.format)).toEqual(
        expect.arrayContaining(['esm', 'umd'])
      );
      expect(runRollup.calls.allArgs().map(x => x[0].output)).toEqual(
        expect.arrayContaining([
          {
            format: 'umd',
            file: '/root/dist/ui/example.umd.js',
            name: 'Example'
          },
          {
            format: 'esm',
            file: '/root/dist/ui/example.esm2015.js',
            name: 'Example'
          },
          {
            format: 'esm',
            file: '/root/dist/ui/example.esm5.js',
            name: 'Example'
          }
        ])
      );
      expect(result.success).toBe(true);
    });

    it('should return failure when one run fails', async () => {
      let count = 0;
      runRollup = spyOn(rr, 'runRollup').and.callFake(() => {
        return of({
          success: count++ === 0
        });
      });

      const result = await impl.run(testOptions, context).toPromise();

      expect(result.success).toBe(false);
    });

    it('updates package.json', async () => {
      runRollup = spyOn(rr, 'runRollup').and.callFake(() => {
        return of({
          success: true
        });
      });

      await impl.run(testOptions, context).toPromise();

      expect(f.writeJsonFile).toHaveBeenCalled();

      const content = writeJsonFile.calls.allArgs()[0][1];
      expect(content).toMatchObject({
        name: 'example',
        main: './example.umd.js',
        module: './example.esm5.js',
        es2015: './example.esm2015.js',
        typings: './index.d.ts'
      });
    });
  });
});
