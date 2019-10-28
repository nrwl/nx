import { workspaces } from '@angular-devkit/core';
import { run, WebBuildBuilderOptions } from './build.impl';
import { of } from 'rxjs';
import * as buildWebpack from '@angular-devkit/build-webpack';
jest.mock('tsconfig-paths-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import * as webConfigUtils from '../../utils/web.config';
import { getMockContext, MockBuilderContext } from '../../utils/testing';
import { join } from 'path';
import * as indexHtmlUtils from '../../utils/build-angular/angular-cli-files/utilities/index-file/write-index-html';

describe('WebBuildBuilder', () => {
  let context: MockBuilderContext;
  let testOptions: WebBuildBuilderOptions;
  let runWebpack: jasmine.Spy;
  let writeIndexHtml: jasmine.Spy;

  beforeEach(async () => {
    context = await getMockContext();
    testOptions = {
      index: 'apps/webapp/src/index.html',
      budgets: [],
      baseHref: '/',
      optimization: true,
      deployUrl: '/',
      scripts: ['apps/webapp/src/scripts.js'],
      styles: ['apps/webapp/src/styles.css'],
      main: 'apps/webapp/src/main.ts',
      tsConfig: 'apps/webapp/tsconfig.app.json',
      outputPath: 'dist/apps/webapp',
      fileReplacements: [
        {
          replace: 'apps/webapp/environment/environment.ts',
          with: 'apps/webapp/environment/environment.prod.ts'
        },
        {
          replace: 'module1.ts',
          with: 'module2.ts'
        }
      ],
      assets: [],
      statsJson: false
    };
    const stats = {
      stats: 'stats'
    };
    runWebpack = spyOn(buildWebpack, 'runWebpack').and.callFake(
      (config, context, opts) => {
        opts.logging({
          toJson: () => stats,
          toString: () => JSON.stringify(stats)
        });
        return of({
          success: true,
          emittedFiles: [
            {
              file: 'scripts.js',
              extension: '.js'
            },
            {
              file: 'styles.css',
              extension: '.css'
            }
          ]
        });
      }
    );
    spyOn(workspaces, 'readWorkspace').and.returnValue({
      workspace: {
        projects: {
          get: () => ({
            sourceRoot: join(__dirname, '../../..')
          })
        }
      }
    });
    spyOn(webConfigUtils, 'getWebConfig').and.returnValue({
      config: 'config'
    });
    writeIndexHtml = spyOn(indexHtmlUtils, 'writeIndexHtml').and.returnValue(
      of(null)
    );
    (<any>TsConfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );
  });

  describe('run', () => {
    it('should call runWebpack', async () => {
      await run(testOptions, context).toPromise();

      expect(runWebpack).toHaveBeenCalled();
    });

    it('should emit success', async () => {
      const buildEvent = await run(testOptions, context).toPromise();

      expect(buildEvent.success).toEqual(true);
    });

    it('should write the HTML', async () => {
      await run(testOptions, context).toPromise();

      expect(writeIndexHtml).toHaveBeenCalled();
    });

    describe('differential loading', () => {
      it('should call runWebpack twice', async () => {
        await run(testOptions, context).toPromise();

        expect(runWebpack).toHaveBeenCalledTimes(2);
      });
    });

    describe('webpackConfig option', () => {
      it('should require the specified function and use the return value', async () => {
        const mockFunction = jest.fn(config => ({
          config: 'config'
        }));
        jest.mock('/root/apps/webapp/webpack.config.js', () => mockFunction, {
          virtual: true
        });
        await run(
          {
            ...testOptions,
            webpackConfig: './apps/webapp/webpack.config.js'
          },
          context
        ).toPromise();

        expect(mockFunction).toHaveBeenCalled();
        expect(runWebpack.calls.first().args[0]).toEqual({
          config: 'config'
        });
      });
    });
  });
});
