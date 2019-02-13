import { join, normalize } from '@angular-devkit/core';
import { TestLogger } from '@angular-devkit/architect/testing';
import BuildNodeBuilder from './node-build.builder';
import { BuildNodeBuilderOptions } from './node-build.builder';
import { of } from 'rxjs';
import * as fs from 'fs';

describe('NodeBuildBuilder', () => {
  let builder: BuildNodeBuilder;
  let testOptions: BuildNodeBuilderOptions;
  let sourceRoot: string;

  beforeEach(() => {
    builder = new BuildNodeBuilder({
      host: <any>{},
      logger: new TestLogger('test'),
      workspace: <any>{
        root: '/root'
      },
      architect: <any>{},
      targetSpecifier: {
        project: 'nodeapp',
        target: 'build'
      }
    });
    sourceRoot = '/root/apps/nodeapp/src';
    testOptions = {
      main: 'apps/nodeapp/src/main.ts',
      tsConfig: 'apps/nodeapp/tsconfig.app.json',
      outputPath: 'dist/apps/nodeapp',
      externalDependencies: 'all',
      fileReplacements: [
        {
          replace: 'apps/environment/environment.ts',
          with: 'apps/environment/environment.prod.ts'
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
        root: normalize('/root'),
        projectType: 'application',
        builder: '@nrwl/builders:node-build',
        options: testOptions
      });

      expect(runWebpack).toHaveBeenCalled();
    });

    it('should emit the outfile along with success', async () => {
      const runWebpack = spyOn(
        builder.webpackBuilder,
        'runWebpack'
      ).and.returnValue(
        of({
          success: true
        })
      );

      const buildEvent = await builder
        .run({
          root: normalize('/root'),
          projectType: 'application',
          builder: '@nrwl/builders:node-build',
          options: testOptions
        })
        .toPromise();

      expect(buildEvent.success).toEqual(true);
      expect(buildEvent.outfile).toEqual('/root/dist/apps/nodeapp/main.js');
    });

    describe('when stats json option is passed', () => {
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
            root: normalize('/root'),
            projectType: 'application',
            builder: '@nrwl/builders:node-build',
            options: {
              ...testOptions,
              statsJson: true
            }
          })
          .toPromise();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          '/root/dist/apps/nodeapp/stats.json',
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
          join(normalize('/root'), 'apps/nodeapp/webpack.config.js'),
          () => mockFunction,
          {
            virtual: true
          }
        );
        await builder
          .run({
            root: normalize('/root'),
            sourceRoot: join(normalize('/root'), 'apps/nodeapp'),
            projectType: 'application',
            builder: '@nrwl/builders:node-build',
            options: {
              ...testOptions,
              webpackConfig: 'apps/nodeapp/webpack.config.js'
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
