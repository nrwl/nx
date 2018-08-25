import { normalize } from '@angular-devkit/core';
import { TestLogger } from '@angular-devkit/architect/testing';
import BuildNodeBuilder from './node-build.builder';
import { BuildNodeBuilderOptions } from './node-build.builder';
import { of } from 'rxjs';
import * as fs from 'fs';

describe('NodeBuildBuilder', () => {
  let builder: BuildNodeBuilder;
  let testOptions: BuildNodeBuilderOptions;

  beforeEach(() => {
    builder = new BuildNodeBuilder({
      host: <any>{},
      logger: new TestLogger('test'),
      workspace: <any>{
        root: '/root'
      },
      architect: <any>{}
    });
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
      ]
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
  });

  describe('options normalization', () => {
    it('should add the root', () => {
      const result = (<any>builder).normalizeOptions(testOptions);
      expect(result.root).toEqual('/root');
    });

    it('should resolve main from root', () => {
      const result = (<any>builder).normalizeOptions(testOptions);
      expect(result.main).toEqual('/root/apps/nodeapp/src/main.ts');
    });

    it('should resolve the output path', () => {
      const result = (<any>builder).normalizeOptions(testOptions);
      expect(result.outputPath).toEqual('/root/dist/apps/nodeapp');
    });

    it('should resolve the tsConfig path', () => {
      const result = (<any>builder).normalizeOptions(testOptions);
      expect(result.tsConfig).toEqual('/root/apps/nodeapp/tsconfig.app.json');
    });

    it('should resolve the file replacement paths', () => {
      const result = (<any>builder).normalizeOptions(testOptions);
      expect(result.fileReplacements).toEqual([
        {
          replace: '/root/apps/environment/environment.ts',
          with: '/root/apps/environment/environment.prod.ts'
        },
        {
          replace: '/root/module1.ts',
          with: '/root/module2.ts'
        }
      ]);
    });
  });
});
