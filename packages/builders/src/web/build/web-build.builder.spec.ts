import { normalize, join } from '@angular-devkit/core';
import { TestLogger } from '@angular-devkit/architect/testing';
import WebBuildBuilder from './web-build.builder';
import { WebBuildBuilderOptions } from './web-build.builder';
import { of } from 'rxjs';
import * as fs from 'fs';

describe('WebBuildBuilder', () => {
  let builder: WebBuildBuilder;
  let testOptions: WebBuildBuilderOptions;

  beforeEach(() => {
    builder = new WebBuildBuilder({
      host: <any>{},
      logger: new TestLogger('test'),
      workspace: <any>{
        root: __dirname
      },
      architect: <any>{},
      targetSpecifier: {
        project: 'webapp',
        target: 'build'
      }
    });
    testOptions = {
      index: 'apps/webapp/src/index.html',
      budgets: [],
      baseHref: '/',
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
  });

  describe('run', () => {
    it('should call runWebpack', () => {
      const runWebpack = spyOn(
        builder.webpackBuilder,
        'runWebpack'
      ).and.returnValue(
        of({
          success: true
        })
      );

      builder.run({
        root: normalize(__dirname),
        sourceRoot: join(normalize(__dirname), 'apps/webapp'),
        projectType: 'application',
        builder: '@nrwl/builders:node-build',
        options: testOptions
      });

      expect(runWebpack).toHaveBeenCalled();
    });

    it('should emit success', async () => {
      spyOn(builder.webpackBuilder, 'runWebpack').and.returnValue(
        of({
          success: true
        })
      );

      const buildEvent = await builder
        .run({
          root: normalize(__dirname),
          sourceRoot: join(normalize(__dirname), 'apps/webapp'),
          projectType: 'application',
          builder: '@nrwl/builders:node-build',
          options: testOptions
        })
        .toPromise();

      expect(buildEvent.success).toEqual(true);
    });

    describe('statsJson option', () => {
      beforeEach(() => {
        const stats = {
          stats: 'stats'
        };
        spyOn(builder.webpackBuilder, 'runWebpack').and.callFake((opts, cb) => {
          cb({
            toJson: () => stats,
            toString: () => JSON.stringify(stats)
          });
          return of({
            success: true
          });
        });
        spyOn(fs, 'writeFileSync');
      });

      it('should generate a stats json', async () => {
        await builder
          .run({
            root: normalize(__dirname),
            sourceRoot: join(normalize(__dirname), 'apps/webapp'),
            projectType: 'application',
            builder: '@nrwl/builders:web-build',
            options: {
              ...testOptions,
              statsJson: true
            }
          })
          .toPromise();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          join(normalize(__dirname), 'dist/apps/webapp/stats.json'),
          JSON.stringify(
            {
              stats: 'stats'
            },
            null,
            2
          )
        );
      });
    });

    describe('webpackConfig option', () => {
      it('should require the specified function and use the return value', async () => {
        const runWebpack = spyOn(
          builder.webpackBuilder,
          'runWebpack'
        ).and.returnValue(
          of({
            success: true
          })
        );
        const mockFunction = jest.fn(config => ({
          config: 'config'
        }));
        jest.mock(
          join(normalize(__dirname), 'apps/webapp/webpack.config.js'),
          () => mockFunction,
          {
            virtual: true
          }
        );
        await builder
          .run({
            root: normalize(__dirname),
            sourceRoot: join(normalize(__dirname), 'apps/webapp'),
            projectType: 'application',
            builder: '@nrwl/builders:web-build',
            options: {
              ...testOptions,
              webpackConfig: 'apps/webapp/webpack.config.js'
            }
          })
          .toPromise();

        expect(mockFunction).toHaveBeenCalled();
        expect(runWebpack.calls.first().args[0]).toEqual({
          config: 'config'
        });
      });
    });
  });
});
